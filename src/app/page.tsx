
"use client";

import { useEffect, useMemo, useState } from "react";

type AttendanceStatus = "P" | "A" | "L";
type Student = {
  id: string;
  name: string;
  department: string;
  phone: string;
  attendance: Record<string, AttendanceStatus>;
};

const START_YEAR = 2026;
const CAPACITY = 55;
const STORAGE_KEY = "uos-PAIB-attendance-2026";

const pad = (n: number) => String(n).padStart(2, "0");

function makeDates() {
  const dates: string[] = [];
  for (let month = 9; month <= 11; month++) {
    const days = new Date(START_YEAR, month + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      dates.push(
        `${START_YEAR}-${pad(month + 1)}-${pad(day)}`
      );
    }
  }
  return dates;
}

const DATES = makeDates();

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStudent(): Student {
  return {
    id: makeId(),
    name: "",
    department: "",
    phone: "",
    attendance: {},
  };
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function monthDates(month: string) {
  return DATES.filter((date) => date.slice(0, 7) === month);
}

function prettyDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStats(student: Student, dates = DATES) {
  let present = 0;
  let absent = 0;
  let leave = 0;

  dates.forEach((date) => {
    if (student.attendance[date] === "P") present++;
    if (student.attendance[date] === "A") absent++;
    if (student.attendance[date] === "L") leave++;
  });

  const marked = present + absent + leave;
  return {
    present,
    absent,
    leave,
    marked,
    unmarked: dates.length - marked,
    percentage: marked ? Math.round((present / marked) * 100) : 0,
  };
}

const statusStyles: Record<AttendanceStatus, string> = {
  P: "bg-emerald-100 text-emerald-800 border-emerald-200",
  A: "bg-rose-100 text-rose-800 border-rose-200",
  L: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function Page() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [activeMonth, setActiveMonth] = useState("2026-10");
  const [selectedDate, setSelectedDate] = useState("2026-10-01");
  const [tab, setTab] = useState<"overview" | "register" | "reports">(
    "overview"
  );
  const [notice, setNotice] = useState("");
  const [newStudent, setNewStudent] = useState({
    name: "",
    department: "",
    phone: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Student[];
        if (Array.isArray(parsed)) setStudents(parsed);
      }
    } catch {
      setNotice("Saved data could not be loaded.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch {
      setNotice("Storage is full. Export your CSV backup.");
    }
  }, [students, loaded]);

  const currentDates = useMemo(
    () => monthDates(activeMonth),
    [activeMonth]
  );

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => student.department.trim())
            .filter(Boolean)
        )
      ).sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase().trim();
    return students.filter((student) => {
      const matchesSearch =
        !term ||
        student.name.toLowerCase().includes(term) ||
        student.phone.toLowerCase().includes(term) ||
        student.department.toLowerCase().includes(term);

      const matchesDepartment =
        departmentFilter === "All" ||
        student.department === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [students, search, departmentFilter]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let marked = 0;

    students.forEach((student) => {
      const stats = getStats(student);
      present += stats.present;
      absent += stats.absent;
      leave += stats.leave;
      marked += stats.marked;
    });

    return {
      present,
      absent,
      leave,
      marked,
      possible: students.length * DATES.length,
      percentage: marked ? Math.round((present / marked) * 100) : 0,
    };
  }, [students]);

  function updateStudent(id: string, changes: Partial<Student>) {
    setStudents((old) =>
      old.map((student) =>
        student.id === id ? { ...student, ...changes } : student
      )
    );
  }

  function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newStudent.name.trim()) {
      setNotice("Please enter the student's name.");
      return;
    }

    if (students.length >= CAPACITY) {
      setNotice(`The register is full. Maximum capacity is ${CAPACITY}.`);
      return;
    }

    const student: Student = {
      id: makeId(),
      name: newStudent.name.trim(),
      department: newStudent.department.trim(),
      phone: newStudent.phone.trim(),
      attendance: {},
    };

    setStudents((old) => [...old, student]);
    setNewStudent({ name: "", department: "", phone: "" });
    setNotice("Student added successfully.");
  }

  function removeStudent(id: string) {
    const student = students.find((item) => item.id === id);
    if (!student) return;

    if (
      window.confirm(
        `Delete ${student.name || "this student"} and all their attendance records?`
      )
    ) {
      setStudents((old) => old.filter((item) => item.id !== id));
      setNotice("Student deleted.");
    }
  }

  function markAttendance(id: string, date: string, value: string) {
    setStudents((old) =>
      old.map((student) => {
        if (student.id !== id) return student;
        const attendance = { ...student.attendance };

        if (!value) {
          delete attendance[date];
        } else {
          attendance[date] = value as AttendanceStatus;
        }

        return { ...student, attendance };
      })
    );
  }

  function markAll(value: AttendanceStatus | "") {
    if (
      !window.confirm(
        `Set all ${filteredStudents.length} visible students to ${
          value || "unmarked"
        } for ${prettyDate(selectedDate)}?`
      )
    ) {
      return;
    }

    setStudents((old) =>
      old.map((student) => {
        if (!filteredStudents.some((item) => item.id === student.id)) {
          return student;
        }

        const attendance = { ...student.attendance };
        if (value) attendance[selectedDate] = value;
        else delete attendance[selectedDate];

        return { ...student, attendance };
      })
    );

    setNotice("Attendance updated for visible students.");
  }

  function exportFullRegister() {
    const headers = [
      "Student Name",
      "Department",
      "Mobile Number",
      ...DATES,
      "Present",
      "Absent",
      "Leave",
      "Attendance %",
    ];

    const rows = students.map((student) => {
      const stats = getStats(student);
      return [
        student.name,
        student.department,
        student.phone,
        ...DATES.map((date) => student.attendance[date] || ""),
        stats.present,
        stats.absent,
        stats.leave,
        `${stats.percentage}%`,
      ];
    });

    downloadCSV("UOS_PAIB_Full_Attendance_2026.csv", [headers, ...rows]);
  }

  function exportMonthlyReport() {
    const headers = [
      "Student Name",
      "Department",
      "Mobile Number",
      ...currentDates,
      "Present",
      "Absent",
      "Leave",
      "Attendance %",
    ];

    const rows = students.map((student) => {
      const stats = getStats(student, currentDates);
      return [
        student.name,
        student.department,
        student.phone,
        ...currentDates.map((date) => student.attendance[date] || ""),
        stats.present,
        stats.absent,
        stats.leave,
        `${stats.percentage}%`,
      ];
    });

    downloadCSV(`UOS_PAIB_${activeMonth}_Attendance.csv`, [
      headers,
      ...rows,
    ]);
  }

  const selectedDateStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let unmarked = 0;

    students.forEach((student) => {
      const status = student.attendance[selectedDate];
      if (status === "P") present++;
      else if (status === "A") absent++;
      else if (status === "L") leave++;
      else unmarked++;
    });

    return { present, absent, leave, unmarked };
  }, [students, selectedDate]);

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

  const months = [
    { value: "2026-10", label: "October" },
    { value: "2026-11", label: "November" },
    { value: "2026-12", label: "December" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-slate-950 via-teal-950 to-emerald-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black">
                U
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
                  University of Sargodha
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  PAIB Attendance Portal
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                   Pakistan Artificial Intelligence Blockchain · In-charge: Sir Asif
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-xs text-teal-200">Attendance period</p>
              <p className="mt-1 font-bold">01 Oct – 31 Dec 2026</p>
              <p className="mt-1 text-xs text-slate-300">
                92 calendar days · {CAPACITY} student capacity
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          >
            <span>{notice}</span>
            <button
              onClick={() => setNotice("")}
              className="font-bold"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Registered students",
              value: students.length,
              detail: `Capacity ${CAPACITY}`,
              icon: "👥",
            },
            {
              label: "Present records",
              value: totals.present,
              detail: "Across all 92 days",
              icon: "✓",
            },
            {
              label: "Absent records",
              value: totals.absent,
              detail: "Across all 92 days",
              icon: "×",
            },
            {
              label: "Overall attendance",
              value: `${totals.percentage}%`,
              detail: `${totals.marked.toLocaleString()} marks recorded`,
              icon: "%",
            },
          ].map((item) => (
            <div key={item.label} className={cardClass}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">
                  {item.label}
                </p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 font-bold text-teal-800">
                  {item.icon}
                </span>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className={cardClass}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Student management</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add students, maintain contact details and manage the register.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">
              {students.length} / {CAPACITY} students
            </div>
          </div>

          <form
            onSubmit={addStudent}
            className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4"
          >
            <input
              className={inputClass}
              placeholder="Student full name *"
              value={newStudent.name}
              onChange={(e) =>
                setNewStudent({ ...newStudent, name: e.target.value })
              }
              required
            />
            <input
              className={inputClass}
              placeholder="Department / program"
              value={newStudent.department}
              onChange={(e) =>
                setNewStudent({
                  ...newStudent,
                  department: e.target.value,
                })
              }
            />
            <input
              className={inputClass}
              placeholder="Mobile number"
              type="tel"
              value={newStudent.phone}
              onChange={(e) =>
                setNewStudent({ ...newStudent, phone: e.target.value })
              }
            />
            <button
              type="submit"
              disabled={students.length >= CAPACITY}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add student
            </button>
          </form>

          <p className="mt-3 text-xs text-slate-500">
            Your student list and attendance are saved in this browser. Export
            regular backups to avoid losing records.
          </p>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold">Attendance workspace</h2>
              <p className="mt-1 text-sm text-slate-500">
                Mark present, absent or leave for a selected date.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "overview", label: "Overview" },
                { value: "register", label: "Daily register" },
                { value: "reports", label: "Reports" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value as typeof tab)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    tab === item.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Select month
              </label>
              <select
                className={inputClass}
                value={activeMonth}
                onChange={(e) => {
                  setActiveMonth(e.target.value);
                  setSelectedDate(`${e.target.value}-01`);
                }}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label} 2026
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Attendance date
              </label>
              <select
                className={inputClass}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {currentDates.map((date) => (
                  <option key={date} value={date}>
                    {prettyDate(date)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Search students
              </label>
              <input
                className={inputClass}
                placeholder="Name, department, mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Present",
                value: selectedDateStats.present,
                style: "bg-emerald-50 text-emerald-800",
              },
              {
                label: "Absent",
                value: selectedDateStats.absent,
                style: "bg-rose-50 text-rose-800",
              },
              {
                label: "Leave",
                value: selectedDateStats.leave,
                style: "bg-amber-50 text-amber-800",
              },
              {
                label: "Unmarked",
                value: selectedDateStats.unmarked,
                style: "bg-slate-100 text-slate-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl px-4 py-3 ${item.style}`}
              >
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="mt-1 text-2xl font-black">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => markAll("P")}
                className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
              >
                Mark all present
              </button>
              <button
                onClick={() => markAll("A")}
                className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-200"
              >
                Mark all absent
              </button>
              <button
                onClick={() => markAll("")}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Clear date
              </button>
            </div>

            <select
              className={`${inputClass} sm:max-w-52`}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="All">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          {tab === "overview" && (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold">Monthly attendance snapshot</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Based on marks recorded for each month.
                </p>
                <div className="mt-4 space-y-4">
                  {months.map((month) => {
                    let present = 0;
                    let marked = 0;

                    students.forEach((student) => {
                      monthDates(month.value).forEach((date) => {
                        const status = student.attendance[date];
                        if (status) marked++;
                        if (status === "P") present++;
                      });
                    });

                    const percentage = marked
                      ? Math.round((present / marked) * 100)
                      : 0;

                    return (
                      <div key={month.value}>
                        <div className="mb-1.5 flex justify-between text-sm">
                          <span className="font-semibold">{month.label}</span>
                          <span className="text-slate-500">
                            {percentage}% · {marked} marks
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold">Attendance legend</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Use these status codes in the daily register.
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      code: "P",
                      label: "Present",
                      desc: "Student attended",
                    },
                    {
                      code: "A",
                      label: "Absent",
                      desc: "Student did not attend",
                    },
                    {
                      code: "L",
                      label: "Leave",
                      desc: "Approved or recorded leave",
                    },
                    {
                      code: "—",
                      label: "Unmarked",
                      desc: "No attendance entered yet",
                    },
                  ].map((item) => (
                    <div
                      key={item.code}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 font-black">
                        {item.code}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "register" && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Department / mobile</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Recorded status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => {
                    const status = student.attendance[selectedDate];

                    return (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-400">
                          {students.findIndex(
                            (item) => item.id === student.id
                          ) + 1}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-slate-200 focus:border-teal-400 focus:outline-none"
                            value={student.name}
                            onChange={(e) =>
                              updateStudent(student.id, {
                                name: e.target.value,
                              })
                            }
                            aria-label="Student name"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="mb-1 w-40 rounded-lg border border-transparent bg-transparent px-2 py-1 hover:border-slate-200 focus:border-teal-400 focus:outline-none"
                            value={student.department}
                            onChange={(e) =>
                              updateStudent(student.id, {
                                department: e.target.value,
                              })
                            }
                            placeholder="Department"
                            aria-label="Student department"
                          />
                          <input
                            className="block w-40 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-slate-500 hover:border-slate-200 focus:border-teal-400 focus:outline-none"
                            value={student.phone}
                            onChange={(e) =>
                              updateStudent(student.id, {
                                phone: e.target.value,
                              })
                            }
                            placeholder="Mobile number"
                            aria-label="Student mobile number"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {(["P", "A", "L"] as AttendanceStatus[]).map(
                              (value) => (
                                <button
                                  key={value}
                                  onClick={() =>
                                    markAttendance(
                                      student.id,
                                      selectedDate,
                                      status === value ? "" : value
                                    )
                                  }
                                  className={`h-9 w-9 rounded-lg border text-xs font-black transition ${
                                    status === value
                                      ? statusStyles[value]
                                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  }`}
                                  aria-label={`Mark ${student.name} ${value}`}
                                  aria-pressed={status === value}
                                  title={
                                    value === "P"
                                      ? "Present"
                                      : value === "A"
                                        ? "Absent"
                                        : "Leave"
                                  }
                                >
                                  {value}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {status ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}
                            >
                              {status === "P"
                                ? "Present"
                                : status === "A"
                                  ? "Absent"
                                  : "Leave"}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not marked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeStudent(student.id)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredStudents.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No students found. Add a student or change your search.
                </p>
              )}
            </div>
          )}

          {tab === "reports" && (
            <div className="mt-6">
              <h3 className="font-bold">
                {months.find((month) => month.value === activeMonth)?.label}{" "}
                2026 report
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Individual attendance statistics for the selected month.
              </p>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Present</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Leave</th>
                      <th className="px-4 py-3">Unmarked</th>
                      <th className="px-4 py-3">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const stats = getStats(student, currentDates);
                      return (
                        <tr key={student.id}>
                          <td className="px-4 py-3 font-semibold">
                            {student.name || "Unnamed student"}
                          </td>
                          <td className="px-4 py-3">
                            {student.department || "—"}
                          </td>
                          <td className="px-4 py-3 text-emerald-700">
                            {stats.present}
                          </td>
                          <td className="px-4 py-3 text-rose-700">
                            {stats.absent}
                          </td>
                          <td className="px-4 py-3 text-amber-700">
                            {stats.leave}
                          </td>
                          <td className="px-4 py-3">{stats.unmarked}</td>
                          <td className="px-4 py-3 font-bold">
                            {stats.percentage}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className={`${cardClass} print:hidden`}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold">Export and backup</h2>
              <p className="mt-1 text-sm text-slate-500">
                Download attendance records or print the current page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportFullRegister}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50"
              >
                Export all 92 days CSV
              </button>
              <button
                onClick={exportMonthlyReport}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50"
              >
                Export monthly CSV
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Print report
              </button>
            </div>
          </div>
        </section>

        <footer className="pb-5 text-center text-xs leading-6 text-slate-500">
          <p className="font-semibold">
            University of Sargodha ·  Pakistan Artificial Intelligence Blockchain
          </p>
          <p>Attendance register · October–December 2026</p>
          <p>Present = P · Absent = A · Leave = L</p>
        </footer>
      </div>
    </main>
  );
}
