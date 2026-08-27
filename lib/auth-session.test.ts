import { describe, expect, it } from "vitest";
import {
  isLoginOrLanding,
  isTeacherRoute,
  resolveSessionGate,
} from "./auth-session";

describe("isTeacherRoute", () => {
  it("matches teacher prefixes and nested paths", () => {
    expect(isTeacherRoute("/dashboard")).toBe(true);
    expect(isTeacherRoute("/students/abc")).toBe(true);
    expect(isTeacherRoute("/login")).toBe(false);
    expect(isTeacherRoute("/try")).toBe(false);
    expect(isTeacherRoute("/hosting")).toBe(false);
  });
});

describe("isLoginOrLanding", () => {
  it("only treats / and /login as bounce-to-dashboard paths", () => {
    expect(isLoginOrLanding("/")).toBe(true);
    expect(isLoginOrLanding("/login")).toBe(true);
    expect(isLoginOrLanding("/hosting")).toBe(false);
  });
});

describe("resolveSessionGate", () => {
  it("sends signed-out users on teacher routes to login", () => {
    expect(
      resolveSessionGate({
        pathname: "/dashboard",
        hasUser: false,
        authUnreachable: false,
      })
    ).toBe("login");
  });

  it("sends signed-in users away from login and landing", () => {
    expect(
      resolveSessionGate({
        pathname: "/login",
        hasUser: true,
        authUnreachable: false,
      })
    ).toBe("dashboard");
  });

  it("lets public pages load when Auth is unreachable", () => {
    expect(
      resolveSessionGate({
        pathname: "/login",
        hasUser: false,
        authUnreachable: true,
      })
    ).toBe("next");
    expect(
      resolveSessionGate({
        pathname: "/",
        hasUser: true,
        authUnreachable: true,
      })
    ).toBe("next");
  });

  it("still sends teacher routes to login when Auth is unreachable", () => {
    expect(
      resolveSessionGate({
        pathname: "/schedule",
        hasUser: true,
        authUnreachable: true,
      })
    ).toBe("login");
  });
});
