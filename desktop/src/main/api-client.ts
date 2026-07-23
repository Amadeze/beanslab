import * as https from "https";
import * as http from "http";
import type {
  PairConnectorRequest,
  PairConnectorResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  UploadResponse,
} from "../shared/types";
import { logger } from "./logger";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const bodyStr = body ? JSON.stringify(body) : undefined;

      const req = transport.request(
        url,
        {
          method,
          headers,
          timeout: 30000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                reject(
                  new ApiError(
                    json.error?.code || "UNKNOWN",
                    json.error?.message || `HTTP ${res.statusCode}`,
                    res.statusCode,
                  ),
                );
              } else {
                resolve(json as T);
              }
            } catch {
              // Check if response is HTML (login page redirect)
              if (data.startsWith("<!DOCTYPE") || data.startsWith("<html")) {
                reject(
                  new ApiError("AUTH_REQUIRED", "Sesi login expired. Silakan login ulang di browser.", 401),
                );
              } else {
                reject(
                  new ApiError("PARSE_ERROR", "Gagal memparse respons server.", 500),
                );
              }
            }
          });
        },
      );

      req.on("error", (err) => {
        reject(
          new ApiError("NETWORK_ERROR", `Koneksi gagal: ${err.message}`, 0),
        );
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new ApiError("TIMEOUT", "Request timeout.", 0));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  async pair(data: PairConnectorRequest): Promise<PairConnectorResponse> {
    logger.info("Pairing with code", { installationId: data.installationId });
    return this.request("POST", "/api/integrations/artisan/connectors/pair", data);
  }

  async heartbeat(
    data: HeartbeatRequest,
    token: string,
  ): Promise<HeartbeatResponse> {
    return this.request(
      "POST",
      "/api/integrations/artisan/connectors/heartbeat",
      data,
      token,
    );
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    fileHash: string,
    fileModifiedAt: string,
    token: string,
  ): Promise<UploadResponse> {
    const url = new URL(
      "/api/integrations/artisan/roasts/upload",
      this.baseUrl,
    );
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const boundary = `----ArtisanSync${Date.now()}`;
      const parts: Buffer[] = [];

      // File part
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
      );
      parts.push(fileBuffer);
      parts.push(Buffer.from("\r\n"));

      // fileHash part
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="fileHash"\r\n\r\n${fileHash}\r\n`,
        ),
      );

      // originalFilename part
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="originalFilename"\r\n\r\n${filename}\r\n`,
        ),
      );

      // fileModifiedAt part
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="fileModifiedAt"\r\n\r\n${fileModifiedAt}\r\n`,
        ),
      );

      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const req = transport.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length.toString(),
            Authorization: `Bearer ${token}`,
          },
          timeout: 60000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                reject(
                  new ApiError(
                    json.error?.code || "UPLOAD_FAILED",
                    json.error?.message || `HTTP ${res.statusCode}`,
                    res.statusCode,
                  ),
                );
              } else {
                resolve(json as UploadResponse);
              }
            } catch {
              reject(
                new ApiError("PARSE_ERROR", "Gagal memparse respons upload.", 500),
              );
            }
          });
        },
      );

      req.on("error", (err) => {
        reject(
          new ApiError("NETWORK_ERROR", `Upload gagal: ${err.message}`, 0),
        );
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new ApiError("TIMEOUT", "Upload timeout.", 0));
      });

      req.write(body);
      req.end();
    });
  }
}

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
