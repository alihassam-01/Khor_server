import { createHash, randomBytes } from "crypto";
import { UserRole } from "@common/enums/user.enums";

export type RealtimeTicketScope = "booking" | "support";

export interface RealtimeTicketActor {
  userId: string;
  userType: UserRole;
}

type StoredTicket = RealtimeTicketActor & {
  scope: RealtimeTicketScope;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 60_000;

export class RealtimeTicketService {
  private readonly tickets = new Map<string, StoredTicket>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly createToken: () => string = () => randomBytes(32).toString("base64url"),
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  issue(actor: RealtimeTicketActor, scope: RealtimeTicketScope): { ticket: string; expiresInSeconds: number } {
    this.pruneExpired();
    const ticket = this.createToken();
    this.tickets.set(this.hash(ticket), {
      ...actor,
      scope,
      expiresAt: this.now() + this.ttlMs,
    });
    return {
      ticket,
      expiresInSeconds: Math.ceil(this.ttlMs / 1000),
    };
  }

  consume(
    ticket: string | undefined,
    expectedScope: RealtimeTicketScope,
    expectedRole: UserRole,
  ): RealtimeTicketActor | null {
    if (!ticket) return null;

    const key = this.hash(ticket);
    const stored = this.tickets.get(key);
    this.tickets.delete(key);

    if (
      !stored ||
      stored.expiresAt <= this.now() ||
      stored.scope !== expectedScope ||
      stored.userType !== expectedRole
    ) {
      return null;
    }

    return { userId: stored.userId, userType: stored.userType };
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, ticket] of this.tickets) {
      if (ticket.expiresAt <= now) {
        this.tickets.delete(key);
      }
    }
  }

  private hash(ticket: string): string {
    return createHash("sha256").update(ticket).digest("hex");
  }
}

export const realtimeTicketService = new RealtimeTicketService();
