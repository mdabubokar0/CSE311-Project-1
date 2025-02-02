import express from "express";
import mysql from "mysql2";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "secret-cloud-jwt-clinic-1234";

const db = mysql.createConnection({
  port: 3307,
  host: "localhost",
  user: "root",
  password: "",
  database: "db",
});

// MIDDLEWARE
const authenticateJWT = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.sendStatus(403);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// Registration
app.post("/register", (req, res) => {
  const { name, email, password, role } = req.body;

  const sql =
    "INSERT INTO admin_request (name, email, password, role) VALUES (?, ?, ?, ?)";

  const values = [name, email, password, role];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error inserting data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({
      message: "Admin request sent successfully",
      patientId: results.insertId,
    });
  });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql =
    "SELECT admin_id AS user_id, name, email, password, role FROM admin_details WHERE email = ? UNION ALL SELECT doctor_id AS user_id, name, email, password, role FROM doctor_details WHERE email = ? UNION ALL SELECT patient_id AS user_id, name, email, password, role FROM patient_details WHERE email = ?";

  db.query(sql, [email, email, email], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = results[0];

    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      role: user.role,
    });
  });
});

// Get user by ID
app.get("/user", authenticateJWT, (req, res) => {
  const { userId, role } = req.user;

  let sql;
  if (role === "admin") {
    sql =
      "SELECT admin_id AS user_id, name, email FROM admin_details WHERE admin_id = ?";
  } else if (role === "doctor") {
    sql =
      "SELECT doctor_id AS user_id, name, email FROM doctor_details WHERE doctor_id = ?";
  } else if (role === "patient") {
    sql =
      "SELECT patient_id AS user_id, name, email FROM patient_details WHERE patient_id = ?";
  } else {
    return res.status(403).json({ error: "Invalid role" });
  }

  db.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];
    console.log(user);
    return res.status(200).json({
      message: "User details retrieved successfully",
      user,
    });
  });
});

// Get user count
app.get("/user/count", authenticateJWT, (req, res) => {
  const sql =
    "SELECT SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS doc_male, SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS doc_female, (SELECT SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) FROM patient_details) AS pat_male, (SELECT SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) FROM patient_details) AS pat_female FROM doctor_details;";

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Count not found" });
    }

    return res.status(200).json(results[0]);
  });
});

// Update user password
app.post("/user/password", authenticateJWT, (req, res) => {
  const { userId, role } = req.user;
  const { old_pass, new_pass } = req.body;

  let sql;
  if (role === "admin") {
    sql = "SELECT password FROM admin_details WHERE admin_id = ?;";
  } else if (role === "doctor") {
    sql = "SELECT password FROM doctor_details WHERE doctor_id = ?;";
  } else if (role === "patient") {
    sql = "SELECT password FROM patient_details WHERE patient_id = ?;";
  } else {
    return res.status(403).json({ error: "Invalid role" });
  }

  db.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];

    if (old_pass !== user.password) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    let updateSql;
    if (role === "admin") {
      updateSql = "UPDATE admin_details SET password = ? WHERE admin_id = ?;";
    } else if (role === "doctor") {
      updateSql = "UPDATE doctor_details SET password = ? WHERE doctor_id = ?;";
    } else if (role === "patient") {
      updateSql = "UPDATE patient_details SET password = ? WHERE patient_id = ?;";
    }

    db.query(updateSql, [new_pass, userId], (err, updateResults) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      return res.status(200).json({
        message: "Password updated successfully",
      });
    });
  });
});

// PATIENT API's
// Create a patient
app.post("/create/patient", authenticateJWT, (req, res) => {
  const {
    name,
    email,
    phone_no,
    address,
    password,
    gender,
    blood_group,
    dob,
    height,
    weight,
    occupation,
    role,
  } = req.body;

  const sql =
    "INSERT INTO patient_details (name, email, phone_no, address, password, gender, blood_group, dob, height, weight, occupation, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  const values = [
    name,
    email,
    phone_no,
    address,
    password,
    gender,
    blood_group,
    dob,
    height,
    weight,
    occupation,
    role,
  ];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error inserting data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({
      message: "Patient details inserted successfully",
      patientId: results.insertId,
    });
  });
});

// Get all patients
app.get("/list/patient", authenticateJWT, (req, res) => {
  const sql = "SELECT * FROM patient_details";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching patient details:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(results);
  });
});

// Get a patient by ID
app.get("/patient/:id", authenticateJWT, (req, res) => {
  const patientId = req.params.id;

  const sql = "SELECT * FROM patient_details WHERE patient_id = ?";

  db.query(sql, [patientId], (err, results) => {
    if (err) {
      console.error("Error retrieving data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.json(results[0]);
  });
});

// Update a patient
app.patch("/update/patient/:id", authenticateJWT, (req, res) => {
  const patientId = req.params.id;

  const {
    name,
    email,
    phone_no,
    address,
    password,
    gender,
    blood_group,
    dob,
    height,
    weight,
    occupation,
    role,
  } = req.body;

  const updates = [];
  const values = [];

  if (name) {
    updates.push("name = ?");
    values.push(name);
  }
  if (email) {
    updates.push("email = ?");
    values.push(email);
  }
  if (phone_no) {
    updates.push("phone_no = ?");
    values.push(phone_no);
  }
  if (address) {
    updates.push("address = ?");
    values.push(address);
  }
  if (password) {
    updates.push("password = ?");
    values.push(password);
  }
  if (gender) {
    updates.push("gender = ?");
    values.push(gender);
  }
  if (blood_group) {
    updates.push("blood_group = ?");
    values.push(blood_group);
  }
  if (dob) {
    updates.push("dob = ?");
    values.push(dob);
  }
  if (height) {
    updates.push("height = ?");
    values.push(height);
  }
  if (weight) {
    updates.push("weight = ?");
    values.push(weight);
  }
  if (occupation) {
    updates.push("occupation = ?");
    values.push(occupation);
  }
  if (role) {
    updates.push("role = ?");
    values.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE patient_details SET ${updates.join(
    ", "
  )} WHERE patient_id = ?`;
  values.push(patientId);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.status(200).json({ message: "Patient profile updated successfully" });
  });
});

// Delete a patient
app.delete("/delete/patient/:id", authenticateJWT, (req, res) => {
  const patientId = req.params.id;

  const sql = "DELETE FROM patient_details WHERE patient_id = ?";

  db.query(sql, [patientId], (err, results) => {
    if (err) {
      console.error("Error deleting data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({ message: "Patient profile deleted successfully" });
  });
});

// DOCTOR API's
// Create a doctor
app.post("/create/doctor", authenticateJWT, (req, res) => {
  const {
    name,
    email,
    phone_no,
    address,
    password,
    gender,
    speciality,
    dept_id,
    role,
  } = req.body;

  const sql =
    "INSERT INTO doctor_details (name, email, phone_no, address, password, gender, speciality, dept_id, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

  const values = [
    name,
    email,
    phone_no,
    address,
    password,
    gender,
    speciality,
    dept_id,
    role,
  ];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error inserting data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({
      message: "Doctor details inserted successfully",
      doctorId: results.insertId,
    });
  });
});

// Get all doctors
app.get("/list/doctor", authenticateJWT, (req, res) => {
  const sql = "SELECT * FROM doctor_details";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching doctor details:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(results);
  });
});

// Get a doctor by ID
app.get("/doctor/:id", authenticateJWT, (req, res) => {
  const doctorId = req.params.id;

  const sql =
    "SELECT doctor_id, name, email, phone_no, address, gender, speciality, dept.dept_name, role FROM doctor_details d, department dept WHERE d.dept_id = dept.dept_id AND doctor_id = ?";

  db.query(sql, [doctorId], (err, results) => {
    if (err) {
      console.error("Error fetching data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.status(200).json(results[0]);
  });
});

// Update a doctor
app.patch("/update/doctor/:id", authenticateJWT, (req, res) => {
  const doctorId = req.params.id;

  const { name, email, phone_no, address, gender, speciality, dept_id, role } =
    req.body;

  const updates = [];
  const values = [];

  if (name) {
    updates.push("name = ?");
    values.push(name);
  }
  if (email) {
    updates.push("email = ?");
    values.push(email);
  }
  if (phone_no) {
    updates.push("phone_no = ?");
    values.push(phone_no);
  }
  if (address) {
    updates.push("address = ?");
    values.push(address);
  }
  if (gender) {
    updates.push("gender = ?");
    values.push(gender);
  }
  if (speciality) {
    updates.push("speciality = ?");
    values.push(speciality);
  }
  if (dept_id) {
    updates.push("dept_id = ?");
    values.push(dept_id);
  }
  if (role) {
    updates.push("role = ?");
    values.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE doctor_details SET ${updates.join(
    ", "
  )} WHERE doctor_id = ?`;
  values.push(doctorId);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.status(200).json({ message: "Doctor profile updated successfully" });
  });
});

// Delete a doctor
app.delete("/delete/doctor/:id", authenticateJWT, (req, res) => {
  const doctorId = req.params.id;

  const sql = "DELETE FROM doctor_details WHERE doctor_id = ?";

  db.query(sql, [doctorId], (err, results) => {
    if (err) {
      console.error("Error deleting data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({ message: "Doctor profile deleted successfully" });
  });
});

// DEPARTMENT API's
// Create a department
app.post("/create/department", (req, res) => {
  const { dept_name } = req.body;
  const sql = "INSERT INTO department (dept_name) VALUES (?)";

  db.query(sql, [dept_name], (err, result) => {
    if (err) return res.status(500).send(err);
    res.status(201).json({ dept_id: result.insertId, dept_name });
  });
});

// Get a department by ID
app.get("/department/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM department WHERE dept_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0)
      return res.status(404).json({ message: "Department not found" });
    res.status(200).json(results[0]);
  });
});

// Update a department
app.patch("/update/department/:id", (req, res) => {
  const deptId = req.params.id;
  const { dept_name } = req.body;

  const updates = [];
  const values = [];

  if (dept_name) {
    updates.push("dept_name = ?");
    values.push(dept_name);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE department SET ${updates.join(", ")} WHERE dept_id = ?`;
  values.push(deptId);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating data: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.status(200).json({ message: "Department updated successfully" });
  });
});

// Delete a department
app.delete("/delete/department/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM department WHERE dept_id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Department not found" });
    res.status(204).send();
  });
});

// Get all departments
app.get("/list/department", authenticateJWT, (req, res) => {
  const sql =
    "SELECT d.dept_id, doc.name AS doc_name, dept_name FROM department d, doctor_details doc, dept_head h WHERE d.dept_id = doc.dept_id AND doc.doctor_id = h.doctor_id;";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching department details:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(results);
  });
});

// TREATMENT PLAN API's
// Create a treatment plan
app.post("/create/treatment-plan", (req, res) => {
  const { patient_id, doctor_id, diagnosis, medications, plan_details } =
    req.body;
  const sql =
    "INSERT INTO treatment_plan (patient_id, doctor_id, diagnosis, medications, plan_details) VALUES (?, ?, ?, ?, ?)";

  db.query(
    sql,
    [patient_id, doctor_id, diagnosis, medications, plan_details],
    (err, result) => {
      if (err) {
        console.error("Error creating treatment plan: ", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({
        treatment_id: result.insertId,
        patient_id,
        doctor_id,
        diagnosis,
        medications,
        plan_details,
      });
    }
  );
});

// Get all treatment plans
app.get("/list/treatment-plan", (req, res) => {
  const sql = "SELECT * FROM treatment_plan";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching treatment plans: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a treatment plan by ID
app.get("/treatment-plan/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM treatment_plan WHERE treatment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching treatment plan: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Treatment plan not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Get a treatment plan by patient ID
app.get("/treatment-plan/patient/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM treatment_plan WHERE patient_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching treatment plan: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Treatment plan not found" });
    }
    res.status(200).json(results);
  });
});

// Update a treatment plan
app.patch("/update/treatment-plan/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, doctor_id, diagnosis, medications, plan_details } =
    req.body;

  const updates = [];
  const values = [];

  if (patient_id) {
    updates.push("patient_id = ?");
    values.push(patient_id);
  }
  if (doctor_id) {
    updates.push("doctor_id = ?");
    values.push(doctor_id);
  }
  if (diagnosis) {
    updates.push("diagnosis = ?");
    values.push(diagnosis);
  }
  if (medications) {
    updates.push("medications = ?");
    values.push(medications);
  }
  if (plan_details) {
    updates.push("plan_details = ?");
    values.push(plan_details);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE treatment_plan SET ${updates.join(
    ", "
  )} WHERE treatment_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating treatment plan: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Treatment plan not found" });
    }
    res.status(200).json({ message: "Treatment plan updated successfully" });
  });
});

// Delete a treatment plan
app.delete("/delete/treatment-plan/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM treatment_plan WHERE treatment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting treatment plan: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Treatment plan not found" });
    }
    res.status(200).json({ message: "Treatment plan deleted successfully" });
  });
});

// APPOINTMENT API's
// Create a new appointment
app.post("/create/appointment", (req, res) => {
  const { doctor_id, patient_id, appointment_date, appointment_time } =
    req.body;

  const checkSql =
    "SELECT * FROM appointment WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?";

  db.query(
    checkSql,
    [doctor_id, appointment_date, appointment_time],
    (err, results) => {
      if (err) {
        console.error("Error checking appointments: ", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length > 0) {
        return res
          .status(400)
          .json({
            error: "Doctor already has an appointment at this date and time.",
          });
      }

      const sql =
        "INSERT INTO appointment (doctor_id, patient_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)";

      db.query(
        sql,
        [doctor_id, patient_id, appointment_date, appointment_time],
        (err, result) => {
          if (err) {
            console.error("Error creating appointment: ", err);
            return res.status(500).json({ error: "Database error" });
          }
          res.status(201).json({
            appointment_id: result.insertId,
            doctor_id,
            patient_id,
            appointment_date,
            appointment_time,
          });
        }
      );
    }
  );
});

// Get all appointments
app.get("/list/appointment", (req, res) => {
  const sql =
    "SELECT appointment_id, doc.name AS doctor_name, pat.name AS patient_name, appointment_date, appointment_time FROM appointment AS app, doctor_details AS doc, patient_details AS pat WHERE doc.doctor_id = app.doctor_id AND pat.patient_id = app.patient_id";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching appointments: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

app.get("/list/appointment/doctor", authenticateJWT, (req, res) => {
  const doctorId = req.user.userId;
  const sql =
    "SELECT appointment_id, doc.name AS doctor_name, pat.name AS patient_name, appointment_date, appointment_time FROM appointment AS app, doctor_details AS doc, patient_details AS pat WHERE doc.doctor_id = app.doctor_id AND pat.patient_id = app.patient_id AND doc.doctor_id = ?";

  db.query(sql, [doctorId], (err, results) => {
    if (err) {
      console.error("Error fetching appointments: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get an appointment by ID
app.get("/appointment/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM appointment WHERE appointment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching appointment: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Update an appointment
app.patch("/update/appointment/:id", (req, res) => {
  const { id } = req.params;
  const { doctor_id, patient_id, appointment_date, appointment_time } =
    req.body;

  const updates = [];
  const values = [];

  if (doctor_id) {
    updates.push("doctor_id = ?");
    values.push(doctor_id);
  }
  if (patient_id) {
    updates.push("patient_id = ?");
    values.push(patient_id);
  }
  if (appointment_date) {
    updates.push("appointment_date = ?");
    values.push(appointment_date);
  }
  if (appointment_time) {
    updates.push("appointment_time = ?");
    values.push(appointment_time);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE appointment SET ${updates.join(
    ", "
  )} WHERE appointment_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating appointment: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.status(200).json({ message: "Appointment updated successfully" });
  });
});

// Delete an appointment
app.delete("/delete/appointment/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM appointment WHERE appointment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting appointment: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.status(200).json({ message: "Appointment deleted successfully" });
  });
});

// MEDICINE API's
// Create a new medicine
app.post("/create/medicine", (req, res) => {
  const { medicine_name, medicine_quantity, medicine_price } = req.body;
  const sql =
    "INSERT INTO medicine (medicine_name, medicine_quantity, medicine_price) VALUES (?, ?, ?)";

  db.query(
    sql,
    [medicine_name, medicine_quantity, medicine_price],
    (err, result) => {
      if (err) {
        console.error("Error creating medicine: ", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({
        medicine_id: result.insertId,
        medicine_name,
        medicine_quantity,
        medicine_price,
      });
    }
  );
});

// Get all medicine
app.get("/list/medicine", (req, res) => {
  const sql =
    "SELECT medicine_id, medicine_name, medicine_quantity, medicine_price, (medicine_quantity*medicine_price) AS total FROM medicine";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching medicines: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a medicine by ID
app.get("/medicine/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM medicine WHERE medicine_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching medicine: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Update a medicine
app.patch("/update/medicine/:id", (req, res) => {
  const { id } = req.params;
  const { medicine_name, medicine_quantity, medicine_price } = req.body;

  const updates = [];
  const values = [];

  if (medicine_name) {
    updates.push("medicine_name = ?");
    values.push(medicine_name);
  }
  if (medicine_quantity) {
    updates.push("medicine_quantity = ?");
    values.push(medicine_quantity);
  }
  if (medicine_price) {
    updates.push("medicine_price = ?");
    values.push(medicine_price);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE medicine SET ${updates.join(", ")} WHERE medicine_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating medicine: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    res.status(200).json({ message: "Medicine updated successfully" });
  });
});

// Delete a medicine
app.delete("/delete/medicine/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM medicine WHERE medicine_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting medicine: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    res.status(200).json({ message: "Medicine deleted successfully" });
  });
});

// SERVICE API's
// Create a new service
app.post("/create/service", (req, res) => {
  const { treatment_id, service_name, service_cost } = req.body;

  const checkSql =
    "SELECT treatment_id FROM treatment_plan WHERE treatment_id = ?";
  db.query(checkSql, [treatment_id], (err, result) => {
    if (err) {
      console.error("Error checking treatment ID: ", err);
      return res
        .status(500)
        .json({ error: "Database error while verifying treatment ID." });
    }

    if (result.length === 0) {
      return res.status(400).json({
        error: "Invalid treatment ID. Please provide a valid treatment ID.",
      });
    }

    const insertSql =
      "INSERT INTO service (treatment_id, service_name, service_cost) VALUES (?, ?, ?)";
    db.query(
      insertSql,
      [treatment_id, service_name, service_cost],
      (err, result) => {
        if (err) {
          console.error("Error creating service: ", err);
          return res
            .status(500)
            .json({ error: "Database error while creating service." });
        }
        res.status(201).json({
          service_id: result.insertId,
          treatment_id,
          service_name,
          service_cost,
        });
      }
    );
  });
});

// Get all services
app.get("/list/service", (req, res) => {
  const sql = "SELECT * FROM service";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching services: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a service by ID
app.get("/service/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM service WHERE service_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching service: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Get a service by treatment ID
app.get("/service/patient/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM service WHERE treatment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching service: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json(results);
  });
});

// Update a service
app.patch("/update/service/:id", (req, res) => {
  const { id } = req.params;
  const { treatment_id, service_name, service_cost } = req.body;

  const updates = [];
  const values = [];

  if (treatment_id) {
    updates.push("treatment_id = ?");
    values.push(treatment_id);
  }
  if (service_name) {
    updates.push("service_name = ?");
    values.push(service_name);
  }
  if (service_cost) {
    updates.push("service_cost = ?");
    values.push(service_cost);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE service SET ${updates.join(", ")} WHERE service_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating service: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json({ message: "Service updated successfully" });
  });
});

// Delete a service
app.delete("/delete/service/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM service WHERE service_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting service: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json({ message: "Service deleted successfully" });
  });
});

// TEST API's
// Create a new test
app.post("/create/test", (req, res) => {
  const { treatment_id, test_name, test_cost } = req.body;

  const checkSql =
    "SELECT treatment_id FROM treatment_plan WHERE treatment_id = ?";
  db.query(checkSql, [treatment_id], (err, result) => {
    if (err) {
      console.error("Error checking treatment ID: ", err);
      return res
        .status(500)
        .json({ error: "Database error while verifying treatment ID." });
    }

    if (result.length === 0) {
      return res.status(400).json({
        error: "Invalid treatment ID. Please provide a valid treatment ID.",
      });
    }

    const insertSql =
      "INSERT INTO test (treatment_id, test_name, test_cost) VALUES (?, ?, ?)";
    db.query(insertSql, [treatment_id, test_name, test_cost], (err, result) => {
      if (err) {
        console.error("Error creating test: ", err);
        return res
          .status(500)
          .json({ error: "Database error while creating test" });
      }
      res.status(201).json({
        test_id: result.insertId,
        treatment_id,
        test_name,
        test_cost,
      });
    });
  });
});

// Get all tests
app.get("/list/test", (req, res) => {
  const sql = "SELECT * FROM test";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching tests: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a test by ID
app.get("/test/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM test WHERE test_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching test: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Get a test by treatment ID
app.get("/test/patient/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM test WHERE treatment_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching test: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.status(200).json(results);
  });
});

// Update a test
app.patch("/update/test/:id", (req, res) => {
  const { id } = req.params;
  const { treatment_id, test_name, test_cost } = req.body;

  const updates = [];
  const values = [];

  if (treatment_id) {
    updates.push("treatment_id = ?");
    values.push(treatment_id);
  }
  if (test_name) {
    updates.push("test_name = ?");
    values.push(test_name);
  }
  if (test_cost) {
    updates.push("test_cost = ?");
    values.push(test_cost);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE test SET ${updates.join(", ")} WHERE test_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating test: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.status(200).json({ message: "Test updated successfully" });
  });
});

// Delete a test
app.delete("/delete/test/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM test WHERE test_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting test: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.status(200).json({ message: "Test deleted successfully" });
  });
});

// PRESCRIPTION API's
// Create a new prescription
app.post("/create/prescription", (req, res) => {
  const { patient_id, doctor_id, medicines } = req.body;
  if (!Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ error: "At least one medicine must be provided." });
  }

  const insertPrescriptionSql = "INSERT INTO prescription (patient_id, doctor_id) VALUES (?, ?)";
  db.query(insertPrescriptionSql, [patient_id, doctor_id], (err, result) => {
    if (err) {
      console.error("Error creating prescription: ", err);
      return res.status(500).json({ error: "Database error" });
    }

    const prescriptionId = result.insertId;

    const medicineInserts = medicines.map(medicineName => {
      const sql = "INSERT INTO prescription_medicines (prescription_id, medicine_name) VALUES (?, ?)";
      return new Promise((resolve, reject) => {
        db.query(sql, [prescriptionId, medicineName], (err, result) => {
          if (err) {
            console.error("Error inserting medicine: ", err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    Promise.all(medicineInserts)
      .then(() => {
        res.status(201).json({
          prescription_id: prescriptionId,
          patient_id,
          doctor_id,
          medicines,
        });
      })
      .catch((err) => {
        console.error("Error inserting medicines:", err);
        res.status(500).json({ error: "Error adding medicines to prescription." });
      });
  });
});

// Get prescriptions for the logged-in doctor
app.get("/list/doctor/prescription", authenticateJWT, (req, res) => {
  const doctorId = req.user.userId;

  const sql = "SELECT * FROM prescription WHERE doctor_id = ?;";

  db.query(sql, [doctorId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(200).json(results);
  });
});

// Get prescriptions for the logged-in patient
app.get("/list/patient/prescription", authenticateJWT, (req, res) => {
  const patientId = req.user.userId;

  const sql = "SELECT * FROM prescription WHERE patient_id = ?;";

  db.query(sql, [patientId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(200).json(results);
  });
});

// Get a prescription by ID
app.get("/prescription/test/:prescriptionId", (req, res) => {
  const { prescriptionId } = req.params;

  const sql = `
    SELECT 
      p.prescription_id, 
      p.patient_id, 
      p.doctor_id, 
      pd.name AS patient_name,
      dd.name AS doctor_name, 
      pm.medicine_name
    FROM prescription p
    JOIN patient_details pd ON p.patient_id = pd.patient_id
    JOIN doctor_details dd ON p.doctor_id = dd.doctor_id
    LEFT JOIN prescription_medicines pm ON p.prescription_id = pm.prescription_id
    WHERE p.prescription_id = ?
  `;

  db.query(sql, [prescriptionId], (err, results) => {
    if (err) {
      console.error("Error fetching prescription details:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const prescription = {
      prescription_id: results[0].prescription_id,
      patient_id: results[0].patient_id,
      doctor_id: results[0].doctor_id,
      patient_name: results[0].patient_name,
      doctor_name: results[0].doctor_name,
      medicines: results.map(row => row.medicine_name).filter(name => name !== null),
    };

    res.status(200).json(prescription);
  });
});

// Update a prescription
app.patch("/update/prescription/:id", (req, res) => {
  const { id } = req.params;
  const { patient_id, doctor_id, medicine_id } = req.body;

  const updates = [];
  const values = [];

  if (patient_id) {
    updates.push("patient_id = ?");
    values.push(patient_id);
  }
  if (doctor_id) {
    updates.push("doctor_id = ?");
    values.push(doctor_id);
  }
  if (medicine_id) {
    updates.push("medicine_id = ?");
    values.push(medicine_id);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sql = `UPDATE prescription SET ${updates.join(
    ", "
  )} WHERE prescription_id = ?`;
  values.push(id);

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating prescription: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    res.status(200).json({ message: "Prescription updated successfully" });
  });
});

// Delete a prescription
app.delete("/delete/prescription/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM prescription WHERE prescription_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting prescription: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    res.status(200).json({ message: "Prescription deleted successfully" });
  });
});

// BILL API's
// Create a new bill
app.post("/create/bill", (req, res) => {
  const { treatment_id } = req.body;

  // Check if the treatment ID exists
  const checkSql =
    "SELECT treatment_id FROM treatment_plan WHERE treatment_id = ?";
  db.query(checkSql, [treatment_id], (err, result) => {
    if (err) {
      console.error("Error checking treatment ID: ", err);
      return res
        .status(500)
        .json({ error: "Database error while verifying treatment ID." });
    }

    // If treatment_id does not exist
    if (result.length === 0) {
      return res
        .status(400)
        .json({
          error: "Invalid treatment ID. Please provide a valid treatment ID.",
        });
    }

    // Proceed to insert the new service
    const insertSql = "INSERT INTO bill (treatment_id) VALUES (?)";
    db.query(insertSql, [treatment_id], (err, result) => {
      if (err) {
        console.error("Error creating service: ", err);
        return res
          .status(500)
          .json({ error: "Database error while creating service." });
      }
      res.status(201).json({
        service_id: result.insertId,
        treatment_id,
      });
    });
  });
});

// Get all bills
app.get("/list/bill", (req, res) => {
  const sql =
    "WITH TestCounts AS (SELECT tp.treatment_id, COUNT(t.test_id) AS total_tests, GROUP_CONCAT(DISTINCT t.test_name SEPARATOR ', ') AS test_names, COALESCE(SUM(t.test_cost), 0) AS total_test_cost FROM treatment_plan tp LEFT JOIN test t ON tp.treatment_id = t.treatment_id GROUP BY tp.treatment_id), ServiceCounts AS (SELECT tp.treatment_id, COUNT(DISTINCT s.service_id) AS total_services, GROUP_CONCAT(DISTINCT s.service_name SEPARATOR ', ') AS service_names, COALESCE(SUM(s.service_cost), 0) AS total_service_cost FROM treatment_plan tp LEFT JOIN service s ON tp.treatment_id = s.treatment_id GROUP BY tp.treatment_id) SELECT b.bill_id, tp.treatment_id, p.name AS patient_name, d.name AS doctor_name, tc.test_names, tc.total_tests, sc.service_names, sc.total_services, tc.total_test_cost, sc.total_service_cost, (tc.total_test_cost + sc.total_service_cost) AS total_amount FROM bill b JOIN treatment_plan tp ON b.treatment_id = tp.treatment_id JOIN patient_details p ON p.patient_id = tp.patient_id JOIN doctor_details d ON d.doctor_id = tp.doctor_id LEFT JOIN TestCounts tc ON tp.treatment_id = tc.treatment_id LEFT JOIN ServiceCounts sc ON tp.treatment_id = sc.treatment_id;";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching bills: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a bill by ID
app.get("/bill/:id", (req, res) => {
  const { id } = req.params;
  const sql =
    "WITH TestCounts AS (SELECT tp.treatment_id, COUNT(t.test_id) AS total_tests, GROUP_CONCAT(DISTINCT t.test_name SEPARATOR ', ') AS test_names, COALESCE(SUM(t.test_cost), 0) AS total_test_cost FROM treatment_plan tp LEFT JOIN test t ON tp.treatment_id = t.treatment_id GROUP BY tp.treatment_id), ServiceCounts AS (SELECT tp.treatment_id, COUNT(DISTINCT s.service_id) AS total_services, GROUP_CONCAT(DISTINCT s.service_name SEPARATOR ', ') AS service_names, COALESCE(SUM(s.service_cost), 0) AS total_service_cost FROM treatment_plan tp LEFT JOIN service s ON tp.treatment_id = s.treatment_id GROUP BY tp.treatment_id) SELECT b.bill_id, tp.treatment_id, p.name AS patient_name, d.name AS doctor_name, tc.test_names, tc.total_tests, sc.service_names, sc.total_services, tc.total_test_cost, sc.total_service_cost, (tc.total_test_cost + sc.total_service_cost) AS total_amount FROM bill b JOIN treatment_plan tp ON b.treatment_id = tp.treatment_id JOIN patient_details p ON p.patient_id = tp.patient_id JOIN doctor_details d ON d.doctor_id = tp.doctor_id LEFT JOIN TestCounts tc ON tp.treatment_id = tc.treatment_id LEFT JOIN ServiceCounts sc ON tp.treatment_id = sc.treatment_id WHERE b.bill_id = ?;";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching bill: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Delete a bill
app.delete("/delete/bill/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM bill WHERE bill_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting bill: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.status(200).json({ message: "Bill deleted successfully" });
  });
});

// MEDICAL RECORD API's
// Create a new medical record
app.post("/create/medical_record", (req, res) => {
  const { patient_id } = req.body;
  const sql =
    "INSERT INTO medical_record (patient_id) VALUES (?)";

  db.query(sql, [patient_id], (err, result) => {
    if (err) {
      console.error("Error creating medical record: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(201).json({
      record_id: result.insertId,
      patient_id,
    });
  });
});

// Get all medical records
app.get("/list/medical_record", (req, res) => {
  const sql = "SELECT record_id, p.patient_id, name FROM medical_record m JOIN patient_details p ON p.patient_id = m.patient_id";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching medical records: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Get a medical record by ID
app.get("/medical_record/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM medical_record WHERE record_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching medical record: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Medical record not found" });
    }
    res.status(200).json(results[0]);
  });
});

// Delete a medical record
app.delete("/delete/medical_record/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM medical_record WHERE record_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting medical record: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Medical record not found" });
    }
    res.status(200).json({ message: "Medical record deleted successfully" });
  });
});

// REQUEST API's
// Get admin requests
app.get("/list/request", (req, res) => {
  const sql = "SELECT * FROM admin_request";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching admin request: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Accept a request
app.post("/accept/request/:id", (req, res) => {
  const { id } = req.params;
  const fetchSql = "SELECT * FROM admin_request WHERE request_id = ?";
  
  db.query(fetchSql, [id], (fetchErr, fetchResults) => {
    if (fetchErr) {
      console.error("Error fetching request data: ", fetchErr);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (fetchResults.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { name, email, password, role } = fetchResults[0];
    const insertSql = "INSERT INTO admin_details (name, email, password, role) VALUES (?, ?, ?, ?)";
    const values = [name, email, password, role];

    db.query(insertSql, values, (insertErr, insertResults) => {
      if (insertErr) {
        console.error("Error inserting data: ", insertErr);
        return res.status(500).json({ error: "Database error" });
      }

      const deleteSql = "DELETE FROM admin_request WHERE request_id = ?";
      db.query(deleteSql, [id], (deleteErr, deleteResults) => {
        if (deleteErr) {
          console.error("Error deleting request: ", deleteErr);
          return res.status(500).json({ error: "Database error" });
        }

        res.status(201).json({
          message: "Request accepted and transferred successfully",
          adminId: insertResults.insertId,
        });
      });
    });
  });
});

// Delete a request
app.delete("/delete/request/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM admin_request WHERE request_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting request: ", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.status(200).json({ message: "Request deleted successfully" });
  });
});

app.listen(8081, () => {
  console.log("Listening on port 8081");
});
