import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("scanner", "routes/scanner.tsx"),
  route("display", "routes/display.tsx"),
  route("api/backup", "routes/api.backup.ts"),
  route("api/customers", "routes/api.customers.ts"),
  route("api/printer", "routes/api.printer.ts"),
] satisfies RouteConfig;
