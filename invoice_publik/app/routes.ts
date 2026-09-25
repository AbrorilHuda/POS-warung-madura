import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("invoice/:invoiceCode", "routes/invoice.$invoiceCode.tsx"),
  route("api/sync", "routes/api.sync.ts"),
] satisfies RouteConfig;
