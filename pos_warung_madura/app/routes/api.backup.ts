import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import path from "path";
import fs from "fs";
import {
  createLocalBackup,
  getBackupList,
  getBackupStatus,
  inspectBackupFile,
  restoreBackupFile,
  getBackupDirectory,
  deleteBackupFile,
  saveUploadedBackup,
  setCustomBackupDirectory,
} from "../services/backup.server";

/**
 * GET /api/backup — Mengambil status peringatan backup dan daftar riwayat backup
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const downloadFile = url.searchParams.get("download");

  // Jika ada query download file backup
  if (downloadFile) {
    const backupDir = getBackupDirectory();
    const safeFilename = path.basename(downloadFile);
    const filePath = path.join(backupDir, safeFilename);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      const isSql = safeFilename.endsWith(".sql");
      // @ts-ignore Node stream to web stream
      return new Response(fileStream, {
        headers: {
          "Content-Type": isSql ? "application/sql; charset=utf-8" : "application/gzip",
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
          "Content-Length": String(stat.size),
        },
      });
    } else {
      return Response.json({ ok: false, error: "File tidak ditemukan" }, { status: 404 });
    }
  }

  const [status, backups] = await Promise.all([getBackupStatus(), getBackupList()]);

  return Response.json({
    ok: true,
    status,
    backups,
  });
}

/**
 * POST /api/backup — Operasi Backup, Inspect (Uji), Restore, Upload, dan Delete
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. Dukungan Upload File via FormData (multipart/form-data)
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const actionType = (formData.get("action") as string) || "upload";

      if (actionType === "upload") {
        const file = formData.get("backup_file") as File | null;
        if (!file || !(file instanceof File)) {
          return Response.json({ ok: false, error: "Berkas backup wajib dipilih" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const savedMeta = await saveUploadedBackup(file.name, buffer);
        const status = await getBackupStatus();

        return Response.json({
          ok: true,
          message: `Berkas backup '${savedMeta.filename}' berhasil diunggah!`,
          backup: savedMeta,
          status,
        });
      }
    }

    // 2. Operasi via JSON payload
    const body = await request.json();
    const actionType = body.action || "create";

    if (actionType === "create") {
      const passphrase = body.passphrase?.trim();
      const backup = await createLocalBackup({
        reason: "manual",
        passphrase,
      });
      const status = await getBackupStatus();
      return Response.json({
        ok: true,
        message: `Backup berhasil dibuat: ${backup.filename}`,
        backup,
        status,
      });
    }

    if (actionType === "inspect") {
      const filename = body.filename;
      if (!filename) {
        return Response.json({ ok: false, error: "Nama file backup wajib diisi" }, { status: 400 });
      }
      const backupDir = getBackupDirectory();
      const filePath = path.join(backupDir, path.basename(filename));
      const inspect = await inspectBackupFile(filePath, body.passphrase);
      return Response.json({ ok: true, inspect });
    }

    if (actionType === "restore") {
      const filename = body.filename;
      if (!filename) {
        return Response.json({ ok: false, error: "Nama file backup wajib diisi" }, { status: 400 });
      }
      const backupDir = getBackupDirectory();
      const filePath = path.join(backupDir, path.basename(filename));
      const result = await restoreBackupFile(filePath, body.passphrase);

      if (!result.success) {
        return Response.json({ ok: false, error: result.message }, { status: 400 });
      }

      return Response.json({ ok: true, result });
    }

    if (actionType === "delete") {
      const filename = body.filename;
      if (!filename) {
        return Response.json({ ok: false, error: "Nama file backup wajib diisi" }, { status: 400 });
      }
      const success = await deleteBackupFile(filename);
      const status = await getBackupStatus();
      return Response.json({
        ok: success,
        message: success ? `File '${filename}' berhasil dihapus` : "Gagal menghapus file",
        status,
      });
    }

    if (actionType === "set_directory") {
      const targetDir = body.target_directory;
      if (!targetDir) {
        return Response.json({ ok: false, error: "Path direktori tujuan wajib diisi" }, { status: 400 });
      }
      const res = await setCustomBackupDirectory(targetDir);
      const status = await getBackupStatus();
      const backups = await getBackupList();
      return Response.json({
        ok: res.success,
        message: res.message,
        status,
        backups,
      });
    }

    return Response.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (err: any) {
    console.error("[api.backup action error]:", err);
    return Response.json({ ok: false, error: err.message || "Terjadi kesalahan server" }, { status: 500 });
  }
}
