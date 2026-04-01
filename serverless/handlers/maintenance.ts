import { z } from "zod";

import { getAdminClient, requireUser } from "../supabase.js";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler.js";

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
      const { data, error } = await supabaseAdmin
        .from("maintenance_records")
        .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
        .order("date", { ascending: false });
      if (error) {
        return sendJsonError(res, 500, "DB error", error.message);
      }
      return res.status(200).json({ success: true, records: data ?? [] });
    }

    if (req.method !== "POST") {
      return sendJsonError(res, 405, "Method not allowed");
    }

    const bodySchema = z.discriminatedUnion("action", [
      z.object({
        action: z.literal("create"),
        truckId: z.string().min(1),
        type: z.string().min(1),
        status: z.string().min(1),
        date: z.string().min(1),
        notes: z.string().min(1),
        cost: z.number().nonnegative(),
      }),
      z.object({
        action: z.literal("update"),
        id: z.string().min(1),
        truckId: z.string().min(1),
        type: z.string().min(1),
        status: z.string().min(1),
        date: z.string().min(1),
        notes: z.string().min(1),
        cost: z.number().nonnegative(),
      }),
      z.object({
        action: z.literal("delete"),
        id: z.string().min(1),
      }),
    ]);

    let parsed: z.infer<typeof bodySchema>;
    try {
      parsed = bodySchema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid request";
      return sendJsonError(res, 400, "Invalid request", message);
    }

    if (parsed.action === "delete") {
      const { error } = await supabaseAdmin.from("maintenance_records").delete().eq("id", parsed.id);
      if (error) {
        return sendJsonError(res, 400, "Failed to delete maintenance record", error.message);
      }
      return res.status(200).json({ success: true });
    }

    const payloadBase: any = {
      truck_id: parsed.truckId,
      type: parsed.type,
      status: parsed.status,
      date: parsed.date,
      notes: parsed.notes,
      cost: parsed.cost,
    };

    if (parsed.action === "create") {
      const first = await supabaseAdmin
        .from("maintenance_records")
        .insert(payloadBase)
        .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
        .single();
      if (!first.error) {
        return res.status(200).json({ success: true, record: first.data });
      }

      const msg = String(first.error.message ?? "").toLowerCase();
      if (msg.includes("user_id") && msg.includes("null value")) {
        const second = await supabaseAdmin
          .from("maintenance_records")
          .insert({ ...payloadBase, user_id: auth.user.id } as any)
          .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
          .single();
        if (second.error) {
          return sendJsonError(res, 400, "Failed to create maintenance record", second.error.message);
        }
        return res.status(200).json({ success: true, record: second.data });
      }

      return sendJsonError(res, 400, "Failed to create maintenance record", first.error.message);
    }

    const { data, error } = await supabaseAdmin
      .from("maintenance_records")
      .update(payloadBase)
      .eq("id", parsed.id)
      .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
      .single();
    if (error) {
      return sendJsonError(res, 400, "Failed to update maintenance record", error.message);
    }
    return res.status(200).json({ success: true, record: data });
  },
  { route: "/api/maintenance" },
);

