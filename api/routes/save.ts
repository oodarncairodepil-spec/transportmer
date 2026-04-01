import { handleWithExpressApp } from "../_app.js";

export const config = {
  runtime: "nodejs",
};

export default function handler(req: any, res: any) {
  return handleWithExpressApp(req, res);
}
