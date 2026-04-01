import { z } from "zod";

import { getAdminClient, requireAdmin, requireUser } from "../supabase.js";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler.js";

const workOrderSelect =
  "id,legacy_id,title,driver_id,truck_id,route_name,destinations,notes,priority,status,due_date,created_at,updated_at";

const workOrderHistorySelect = "id,work_order_id,message,attachment_name,attachment_url,created_at";

export default withErrorHandler(
  async (req, res) => {
    requireEnvOrThrow(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

    const auth = await requireUser(req);
    if (!auth.ok) {
      return sendJsonError(res, auth.status, auth.error);
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return sendJsonError(res, 500, "Supabase env not configured");
    }

    if (req.method === "GET") {
      const { data: orders, error } = await supabaseAdmin
        .from("work_orders")
        .select(workOrderSelect)
        .order("created_at", { ascending: false });

      if (error) {
        return sendJsonError(res, 500, "DB error", error.message);
      }

      const orderIds = (orders ?? []).map((o: any) => String(o.id));
      const historyByOrderId = new Map<string, any[]>();

      if (orderIds.length > 0) {
        const { data: historyRows } = await supabaseAdmin
          .from("work_order_history")
          .select(workOrderHistorySelect)
          .in("work_order_id", orderIds)
          .order("created_at", { ascending: true });

        for (const h of historyRows ?? []) {
          const key = String((h as any).work_order_id);
          const list = historyByOrderId.get(key) ?? [];
          list.push(h);
          historyByOrderId.set(key, list);
        }
      }

      const driverIds = Array.from(new Set((orders ?? []).map((o: any) => String(o.driver_id)).filter(Boolean)));
      const truckIds = Array.from(new Set((orders ?? []).map((o: any) => String(o.truck_id)).filter(Boolean)));

      const driverLegacyById = new Map<string, string>();
      const truckLegacyById = new Map<string, string>();

      if (driverIds.length > 0) {
        const { data: driverRows } = await supabaseAdmin.from("drivers").select("id,legacy_id").in("id", driverIds);
        for (const d of driverRows ?? []) {
          driverLegacyById.set(String((d as any).id), String((d as any).legacy_id ?? ""));
        }
      }

      if (truckIds.length > 0) {
        const { data: truckRows } = await supabaseAdmin.from("fleet_trucks").select("id,legacy_id").in("id", truckIds);
        for (const t of truckRows ?? []) {
          truckLegacyById.set(String((t as any).id), String((t as any).legacy_id ?? ""));
        }
      }

      const mapped = (orders ?? []).map((o: any) => {
        const id = String(o.id);
        const history = (historyByOrderId.get(id) ?? []).map((h: any) => ({
          id: String(h.id),
          timestamp: String(h.created_at),
          message: String(h.message ?? ""),
          attachment:
            h.attachment_name && h.attachment_url
              ? { name: String(h.attachment_name), url: String(h.attachment_url) }
              : h.attachment_name
                ? { name: String(h.attachment_name), url: "" }
                : undefined,
        }));

        const destinations = Array.isArray(o.destinations) ? o.destinations : (o.destinations?.destinations ?? o.destinations ?? []);
        return {
          dbId: id,
          id: String(o.legacy_id ?? ""),
          title: String(o.title ?? ""),
          driverId: driverLegacyById.get(String(o.driver_id)) ?? "",
          truckId: truckLegacyById.get(String(o.truck_id)) ?? "",
          pickupLocation: String(o.route_name ?? ""),
          destinations: Array.isArray(destinations) ? destinations.map(String) : [],
          cargoType: String(o.notes ?? ""),
          priority: String(o.priority ?? "Medium"),
          status: String(o.status ?? "Pending"),
          createdAt: String(o.created_at ?? "").slice(0, 10),
          dueDate: String(o.due_date ?? ""),
          history,
        };
      });

      return res.status(200).json({ success: true, workOrders: mapped });
    }

    if (req.method !== "POST") {
      return sendJsonError(res, 405, "Method not allowed");
    }

    const admin = await requireAdmin(auth.user);
    if (!admin.ok) {
      return sendJsonError(res, 403, admin.error);
    }

    const actionSchema = z.discriminatedUnion("action", [
      z.object({
        action: z.literal("create"),
        legacyId: z.string().min(1),
        title: z.string().min(1),
        driverId: z.string().min(1),
        truckId: z.string().min(1),
        routeName: z.string().min(1),
        destinations: z.array(z.string()).default([]),
        notes: z.string().optional(),
        priority: z.enum(["High", "Medium", "Low"]),
        dueDate: z.string().min(1),
      }),
      z.object({
        action: z.literal("update"),
        id: z.string().min(1),
        title: z.string().min(1),
        driverId: z.string().min(1),
        truckId: z.string().min(1),
        routeName: z.string().min(1),
        destinations: z.array(z.string()).default([]),
        notes: z.string().optional(),
        priority: z.enum(["High", "Medium", "Low"]),
        status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]),
        dueDate: z.string().min(1),
      }),
      z.object({
        action: z.literal("delete"),
        id: z.string().min(1),
      }),
      z.object({
        action: z.literal("addHistory"),
        id: z.string().min(1),
        message: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentUrl: z.string().optional(),
      }),
    ]);

    let parsed: z.infer<typeof actionSchema>;
    try {
      parsed = actionSchema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid request";
      return sendJsonError(res, 400, "Invalid request", message);
    }

    if (parsed.action === "delete") {
      const { error } = await supabaseAdmin.from("work_orders").delete().eq("id", parsed.id);
      if (error) {
        return sendJsonError(res, 400, "Failed to delete work order", error.message);
      }
      return res.status(200).json({ success: true });
    }

    if (parsed.action === "addHistory") {
      const { error } = await supabaseAdmin.from("work_order_history").insert({
        work_order_id: parsed.id,
        message: parsed.message ?? "",
        attachment_name: parsed.attachmentName ?? null,
        attachment_url: parsed.attachmentUrl ?? null,
      });
      if (error) {
        return sendJsonError(res, 400, "Failed to add history", error.message);
      }
      return res.status(200).json({ success: true });
    }

    const { data: driverRow, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("legacy_id", parsed.driverId)
      .maybeSingle();
    if (driverErr || !driverRow) {
      return sendJsonError(res, 400, "Invalid driver");
    }

    const { data: truckRow, error: truckErr } = await supabaseAdmin
      .from("fleet_trucks")
      .select("id")
      .eq("legacy_id", parsed.truckId)
      .maybeSingle();
    if (truckErr || !truckRow) {
      return sendJsonError(res, 400, "Invalid truck");
    }

    if (parsed.action === "create") {
      const { data, error } = await supabaseAdmin
        .from("work_orders")
        .insert({
          legacy_id: parsed.legacyId,
          title: parsed.title,
          driver_id: (driverRow as any).id,
          truck_id: (truckRow as any).id,
          route_name: parsed.routeName,
          destinations: parsed.destinations,
          notes: parsed.notes ?? null,
          priority: parsed.priority,
          status: "Pending",
          due_date: parsed.dueDate,
        })
        .select(workOrderSelect)
        .single();
      if (error) {
        return sendJsonError(res, 400, "Failed to create work order", error.message);
      }
      return res.status(200).json({ success: true, workOrder: data });
    }

    const { data, error } = await supabaseAdmin
      .from("work_orders")
      .update({
        title: parsed.title,
        driver_id: (driverRow as any).id,
        truck_id: (truckRow as any).id,
        route_name: parsed.routeName,
        destinations: parsed.destinations,
        notes: parsed.notes ?? null,
        priority: parsed.priority,
        status: parsed.status,
        due_date: parsed.dueDate,
      })
      .eq("id", parsed.id)
      .select(workOrderSelect)
      .single();
    if (error) {
      return sendJsonError(res, 400, "Failed to update work order", error.message);
    }

    return res.status(200).json({ success: true, workOrder: data });
  },
  { route: "/api/work-orders" },
);
