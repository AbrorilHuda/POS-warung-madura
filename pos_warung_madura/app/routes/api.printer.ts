import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getAvailableWindowsPrinters,
  getPrinterSettingsFromDb,
  savePrinterSettingsToDb,
  executeTestPrint,
  executeOpenCashDrawer,
  printSaleReceipt,
  type PrinterSettings,
} from "../services/printer.server";
import type { Sale } from "../types/pos";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const [printers, settings] = await Promise.all([
      getAvailableWindowsPrinters(),
      getPrinterSettingsFromDb(),
    ]);

    return Response.json({
      ok: true,
      printers,
      settings,
    });
  } catch (err: any) {
    return Response.json(
      {
        ok: false,
        error: err.message,
        printers: [],
        settings: null,
      },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "save_settings") {
      const printerType = (formData.get("printer_type") as any) || "windows";
      const printerName = (formData.get("printer_name") as string) || "";
      const networkIp = (formData.get("network_ip") as string) || "192.168.1.200";
      const networkPort = parseInt((formData.get("network_port") as string) || "9100", 10);
      const paperWidth = formData.get("paper_width") === "80" ? 80 : 58;
      const autoPrint = formData.get("auto_print") === "true" || formData.get("auto_print") === "1";
      const autoCut = formData.get("auto_cut") === "true" || formData.get("auto_cut") === "1";
      const openCashDrawer = formData.get("cash_drawer") === "true" || formData.get("cash_drawer") === "1";
      const copies = parseInt((formData.get("copies") as string) || "1", 10);
      const storePhone = (formData.get("store_phone") as string) || "";
      const customFooter = (formData.get("custom_footer") as string) || "";

      await savePrinterSettingsToDb({
        printerType,
        printerName,
        networkIp,
        networkPort,
        paperWidth,
        autoPrint,
        autoCut,
        openCashDrawer,
        copies,
        storePhone,
        customFooter,
      });

      const updated = await getPrinterSettingsFromDb();
      return Response.json({
        ok: true,
        message: "Pengaturan printer berhasil disimpan.",
        settings: updated,
      });
    }

    if (intent === "test_print") {
      const paperWidth = formData.get("paper_width") === "80" ? 80 : 58;
      const printerName = (formData.get("printer_name") as string) || undefined;
      const printerType = (formData.get("printer_type") as any) || undefined;

      const result = await executeTestPrint({
        paperWidth,
        printerName,
        printerType,
      });

      return Response.json({
        ok: result.success,
        message: result.message,
      });
    }

    if (intent === "open_cash_drawer") {
      const result = await executeOpenCashDrawer();
      return Response.json({
        ok: result.success,
        message: result.message,
      });
    }

    if (intent === "print_sale") {
      const saleJson = formData.get("sale") as string;
      const isCopy = formData.get("is_copy") === "true";

      if (!saleJson) {
        return Response.json(
          { ok: false, message: "Data transaksi penjualan tidak ditemukan." },
          { status: 400 }
        );
      }

      const sale: Sale = JSON.parse(saleJson);
      const result = await printSaleReceipt(sale, { isCopy });

      return Response.json({
        ok: result.success,
        message: result.message,
      });
    }

    return Response.json({ ok: false, message: "Intent tidak dikenal." }, { status: 400 });
  } catch (err: any) {
    console.error("[api.printer action error]:", err);
    return Response.json(
      { ok: false, message: err.message || "Terjadi kesalahan internal server printer." },
      { status: 500 }
    );
  }
}
