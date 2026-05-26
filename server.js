const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   SECURITY
========================= */
app.use(helmet());

app.use(cors({
  origin: "*"
}));

app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* =========================
   CONFIG
========================= */
const API_KEY =
  process.env.API_KEY || "sinx-ultra-123";

const JWT_SECRET =
  process.env.JWT_SECRET || "sinx-secret";

/* =========================
   MEMORY CACHE
========================= */
const cache = new Map();

function setCache(key, value) {
  cache.set(key, {
    value,
    time: Date.now()
  });
}

function getCache(key) {
  const item = cache.get(key);

  if (!item) return null;

  // expire after 30 sec
  if (Date.now() - item.time > 30000) {
    cache.delete(key);
    return null;
  }

  return item.value;
}

/* =========================
   LOG SYSTEM
========================= */
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url}`
  );

  next();
});

/* =========================
   API KEY CHECK
========================= */
function hasApiKey(req) {
  return req.headers["x-api-key"] === API_KEY;
}

/* =========================
   JWT CHECK
========================= */
function hasJWT(req) {
  const auth = req.headers.authorization;

  if (!auth) return false;

  try {
    const token = auth.replace("Bearer ", "");

    jwt.verify(token, JWT_SECRET);

    return true;
  } catch (e) {
    return false;
  }
}

/* =========================
   SINX ENCODER
========================= */
function sinxEncode(str) {
  const key = "SINX";

  let output = "";

  for (let i = 0; i < str.length; i++) {
    const code =
      str.charCodeAt(i) ^
      key.charCodeAt(i % key.length);

    output += code
      .toString(16)
      .padStart(2, "0");
  }

  return output;
}

/* =========================
   ROOT STATUS
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "ONLINE",
    service: "SINX FINAL",
    version: "5.0.0",
    uptime: process.uptime(),
    cache: cache.size,
    timestamp: Date.now()
  });
});

/* =========================
   HEALTH
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

/* =========================
   LOGIN
========================= */
app.post("/auth/login", (req, res) => {
  const apiKey = req.body.apiKey;

  if (apiKey !== API_KEY) {
    return res.status(401).json({
      status: "error",
      message: "Invalid API key"
    });
  }

  const token = jwt.sign(
    {
      role: "client"
    },
    JWT_SECRET,
    {
      expiresIn: "1h"
    }
  );

  return res.json({
    status: "success",
    token
  });
});

/* =========================
   METRICS
========================= */
app.get("/metrics", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cacheItems: cache.size
  });
});

/* =========================
   MAIN API
========================= */
app.get("/v1/api.php", (req, res) => {
  const file = req.query.file;

  // auth required
  if (!hasApiKey(req) && !hasJWT(req)) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized"
    });
  }

  const cacheKey = `api:${file}`;

  // cache
  const cached = getCache(cacheKey);

  if (cached) {
    return res.json({
      status: "success",
      source: "cache",
      data: cached
    });
  }

  // endpoint
  if (file === "assetindexer") {
    const payload = {
      assets: [
        {
          id: 1,
          name: "weapon_ak47",
          hash: "a1b2c3d4"
        },
        {
          id: 2,
          name: "skin_dragon",
          hash: "e5f6g7h8"
        },
        {
          id: 3,
          name: "map_city",
          hash: "i9j0k1l2"
        }
      ],
      timestamp: Date.now()
    };

    const encoded = sinxEncode(
      JSON.stringify(payload)
    );

    const response = {
      encoding: "sinx-hex",
      payload: encoded
    };

    setCache(cacheKey, response);

    return res.json({
      status: "success",
      source: "live",
      data: response
    });
  }

  return res.status(404).json({
    status: "error",
    message: "Unknown endpoint"
  });
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found"
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    status: "error",
    message: "Internal server error"
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(
    `🚀 SINX FINAL ONLINE ON PORT ${PORT}`
  );
});