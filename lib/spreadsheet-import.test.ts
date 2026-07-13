import { describe, expect, it } from "vitest";
import {
  familyGroupKey,
  normalizeImportRows,
  parseDelimitedText,
  suggestColumnMapping,
  type NormalizedImportRow,
} from "@/lib/spreadsheet-import";

describe("suggestColumnMapping", () => {
  it("maps common MMS-like headers", () => {
    const mapping = suggestColumnMapping([
      "Student Name",
      "Parent Name",
      "Email",
      "Phone",
      "Birthdate",
      "Level",
    ]);
    expect(mapping.student_name).toBe("Student Name");
    expect(mapping.guardian_name).toBe("Parent Name");
    expect(mapping.email).toBe("Email");
    expect(mapping.phone).toBe("Phone");
    expect(mapping.student_birthdate).toBe("Birthdate");
    expect(mapping.level).toBe("Level");
  });

  it("maps a lone Name column to student_name", () => {
    const mapping = suggestColumnMapping(["Name", "Email"]);
    expect(mapping.student_name).toBe("Name");
    expect(mapping.email).toBe("Email");
  });
});

describe("normalizeImportRows", () => {
  it("skips blank rows and parses US dates", () => {
    const mapping = suggestColumnMapping([
      "Student Name",
      "Email",
      "Birthdate",
    ]);
    const { rows, issues } = normalizeImportRows(
      [
        {
          "Student Name": "Alex",
          Email: "a@example.com",
          Birthdate: "4/12/2015",
        },
        { "Student Name": "", Email: "", Birthdate: "" },
        {
          "Student Name": "",
          Email: "orphan@example.com",
          Birthdate: "",
        },
      ],
      mapping
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].studentName).toBe("Alex");
    expect(rows[0].birthdate).toBe("2015-04-12");
    expect(issues.some((i) => i.message.includes("Missing student name"))).toBe(
      true
    );
  });
});

describe("familyGroupKey", () => {
  it("groups siblings by email", () => {
    const a: NormalizedImportRow = {
      studentName: "Alex",
      birthdate: null,
      level: null,
      teacherNotes: null,
      guardianName: "Jordan",
      familyName: null,
      email: "jordan@example.com",
      phone: null,
      secondaryName: null,
      secondaryEmail: null,
      secondaryPhone: null,
      sourceRow: 2,
    };
    const b = { ...a, studentName: "Sam", sourceRow: 3 };
    expect(familyGroupKey(a)).toBe(familyGroupKey(b));
  });
});

describe("parseDelimitedText", () => {
  it("parses CSV with headers", () => {
    const { headers, rows } = parseDelimitedText(
      "Student Name,Email\nAlex,a@example.com\n"
    );
    expect(headers).toEqual(["Student Name", "Email"]);
    expect(rows[0]["Student Name"]).toBe("Alex");
  });
});
