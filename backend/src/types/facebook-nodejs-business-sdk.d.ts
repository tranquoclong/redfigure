
declare module 'facebook-nodejs-business-sdk' {
  export class UserData {
    setEmail(value: string): this;
    setPhone(value: string): this;
    setFirstName(value: string): this;
    setLastName(value: string): this;
    setDistrict(value: string): this;
    setProvince(value: string): this;
    setZip(value: string): this;
    setCountry(value: string): this;
    setExternalId(value: string): this;
    setClientIpAddress(value: string): this;
    setClientUserAgent(value: string): this;
    setFbc(value: string): this;
    setFbp(value: string): this;
  }

  export class CustomData {
    setValue(value: number): this;
    setCurrency(value: string): this;
    setOrderId(value: string): this;
    setContentIds(value: string[]): this;
    setNumItems(value: number): this;
    setContents(value: unknown[]): this;
  }

  export class ServerEvent {
    setEventName(value: string): this;
    setEventTime(value: number): this;
    setEventId(value: string): this;
    setActionSource(value: string): this;
    setUserData(value: UserData): this;
    setCustomData(value: CustomData): this;
    normalize(): Record<string, unknown>;
  }

  export class EventRequest {
    constructor(accessToken: string, pixelId: string);
    setEvents(events: ServerEvent[]): this;
    execute(): Promise<{ events_received: number; messages?: string[] }>;
  }

  export class Content {
    setId(value: string): this;
    setQuantity(value: number): this;
    setItemPrice(value: number): this;
  }

  export class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }
}
