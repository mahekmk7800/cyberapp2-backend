const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// ============================
// DATABASE
// ============================

const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.log("Database error:", err);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// ============================
// CREATE TABLES
// ============================

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user'
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  category TEXT,
  message TEXT,
  status TEXT DEFAULT 'Pending'
)
`);

// ============================
// DEFAULT ADMIN
// ============================

db.run(
  `INSERT OR IGNORE INTO users (username,password,role) VALUES (?,?,?)`,
  ["admin", "1234", "admin"]
);

// ============================
// LOGIN + AUTO REGISTER
// ============================

app.post("/login", (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Fill all fields" });
  }

  username = username.trim().toLowerCase();
  password = password.trim();

  db.get(
    `SELECT * FROM users WHERE username=?`,
    [username],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (user) {
        if (user.password === password) {
          return res.json({
            username: user.username,
            role: user.role,
          });
        } else {
          return res.status(401).json({ error: "Wrong password" });
        }
      } else {
        db.run(
          `INSERT INTO users (username,password,role) VALUES (?,?,?)`,
          [username, password, "user"],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });

            return res.json({
              username: username,
              role: "user",
              newAccount: true,
            });
          }
        );
      }
    }
  );
});

// ============================
// ADD REPORT
// ============================

app.post("/add", (req, res) => {
  const { name, email, category, message } = req.body;

  db.run(
    `INSERT INTO reports (name,email,category,message) VALUES (?,?,?,?)`,
    [name, email, category, message],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
    }
  );
});

// ============================
// GET ALL REPORTS
// ============================

app.get("/reports", (req, res) => {
  db.all(`SELECT * FROM reports ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(rows);
  });
});

// ============================
// UPDATE REPORT STATUS
// ============================

app.put("/update/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    `UPDATE reports SET status=? WHERE id=?`,
    [status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
    }
  );
});

// ============================
// ANALYTICS
// ============================

app.get("/analytics", (req, res) => {
  db.get(
    `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
    FROM reports
    `,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        total: row?.total || 0,
        approved: row?.approved || 0,
        rejected: row?.rejected || 0,
        pending: row?.pending || 0,
      });
    }
  );
});
// ============================
// DEBUG USERS
// ============================

app.get("/users", (req, res) => {
  db.all(`SELECT * FROM users`, [], (err, rows) => {
    res.json(rows);
  });
});

// ============================
// START SERVER
// ============================

app.listen(8080, "0.0.0.0", () => {
  console.log("Server running on port 8080");
});