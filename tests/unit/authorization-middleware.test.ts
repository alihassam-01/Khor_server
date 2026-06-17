import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../../src/common/enums";
import { authorizeSelfOrAdmin } from "../../src/middlewares/authorizeSelfOrAdmin";

const createReply = () => {
    const state: { statusCode?: number; body?: unknown } = {};
    const reply = {
        status(code: number) {
            state.statusCode = code;
            return this;
        },
        send(body: unknown) {
            state.body = body;
            return this;
        },
    };
    return { reply: reply as any, state };
};

test("owner authorization allows access to the matching profile", async () => {
    const { reply, state } = createReply();
    await authorizeSelfOrAdmin.call(
        {} as any,
        {
            user: { userId: "user-1", userType: UserRole.CUSTOMER },
            params: { id: "user-1" },
        } as any,
        reply,
    );

    assert.equal(state.statusCode, undefined);
});

test("owner authorization allows an admin to access another profile", async () => {
    const { reply, state } = createReply();
    await authorizeSelfOrAdmin.call(
        {} as any,
        {
            user: { userId: "admin-1", userType: UserRole.ADMIN },
            params: { id: "user-1" },
        } as any,
        reply,
    );

    assert.equal(state.statusCode, undefined);
});

test("owner authorization rejects cross-user profile access", async () => {
    const { reply, state } = createReply();
    await authorizeSelfOrAdmin.call(
        {} as any,
        {
            user: { userId: "user-1", userType: UserRole.CUSTOMER },
            params: { id: "user-2" },
        } as any,
        reply,
    );

    assert.equal(state.statusCode, 403);
});
