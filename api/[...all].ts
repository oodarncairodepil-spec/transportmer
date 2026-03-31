import app from "../server/index";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  return app(req as any, res as any);
}

