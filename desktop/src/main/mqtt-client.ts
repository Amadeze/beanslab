import * as mqtt from "mqtt";
import { ApiClient, ApiError } from "./api-client";
import { logger } from "./logger";

export type MqttLivePayload = {
  eventType: string;
  data: {
    BT?: number;
    ET?: number;
    timestamp?: string;
    [key: string]: unknown;
  };
};

export class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private apiClient: ApiClient;
  private token: string;
  private machineId: string;
  private tenantId: string;
  private brokerUrl: string;
  private connected: boolean = false;
  private onData?: (payload: MqttLivePayload) => void;

  constructor(opts: {
    apiClient: ApiClient;
    token: string;
    machineId: string;
    tenantId: string;
    brokerUrl: string;
    onData?: (payload: MqttLivePayload) => void;
  }) {
    this.apiClient = opts.apiClient;
    this.token = opts.token;
    this.machineId = opts.machineId;
    this.tenantId = opts.tenantId;
    this.brokerUrl = opts.brokerUrl;
    this.onData = opts.onData;
  }

  connect(): void {
    if (this.client?.connected) return;

    logger.info("Connecting to MQTT broker", { broker: this.brokerUrl });

    this.client = mqtt.connect(this.brokerUrl, {
      clientId: `ros-sync-${this.machineId}-${Date.now()}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
    });

    this.client.on("connect", () => {
      this.connected = true;
      logger.info("MQTT connected");

      // Subscribe to Artisan live data topic
      const topic = `artisan/${this.tenantId}/${this.machineId}/live`;
      this.client!.subscribe(topic, (err) => {
        if (err) {
          logger.error("MQTT subscribe failed", { error: String(err) });
        } else {
          logger.info("MQTT subscribed", { topic });
        }
      });
    });

    this.client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString()) as MqttLivePayload;
        logger.info("MQTT message received", { topic, eventType: payload.eventType });

        // The operator screen must remain live even when the internet/backend
        // is temporarily unavailable. Forwarding is a separate best-effort path.
        this.onData?.(payload);

        // Forward to ROS backend
        this.forwardToBackend(payload).catch((err) => {
          logger.error("Failed to forward MQTT data", { error: String(err) });
        });
      } catch (err) {
        logger.error("Failed to parse MQTT message", { error: String(err) });
      }
    });

    this.client.on("error", (err) => {
      logger.error("MQTT error", { error: String(err) });
    });

    this.client.on("offline", () => {
      this.connected = false;
      logger.warn("MQTT offline");
    });

    this.client.on("reconnect", () => {
      logger.info("MQTT reconnecting");
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      logger.info("MQTT disconnected");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async forwardToBackend(payload: MqttLivePayload): Promise<void> {
    try {
      logger.debug("MQTT forward payload", { payload: JSON.stringify(payload) });
      await this.apiClient.request(
        "POST",
        "/api/integrations/artisan/mqtt/session",
        payload,
        this.token,
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        logger.warn("MQTT forward auth expired");
      } else {
        logger.warn("MQTT forward failed", { error: String(err) });
      }
    }
  }
}
