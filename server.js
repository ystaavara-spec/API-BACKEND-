const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const Redis = require("ioredis");

const app = express();
const PORT = process.env.PORT || 3000;

/* ========================
   OPTIONAL REDIS (fallback safe)
======================== */
let redis;
try {
  redis = new Redis(process.env.REDIS_URL);
  console.log("⚡ Redis connected");
} catch (e) {
  console.log("⚠️ Redis not available, using memory cache");
}

/* ========================
   SECURITY
======================== */
app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120
  })
);

/* ========================
   LOGGING SYSTEM
======================== */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.url}`);
  next();
});

/* ========================
   MEMORY CACHE fallback
======================== */
const memoryCache = new Map();

async function setCache(key, value) {
  const data = JSON.stringify(value);

  if (redis) await redis.set(key, data, "EX", 30);
  else memoryCache.set(key, { data, time: Date.now() });
}

async function getCache(key) {
  if (redis) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() - item.time > 30000) {
    memoryCache.delete(key);
    return null;
  }

  return JSON.parse(item.data);
}

/* ========================
   API KEYS
======================== */
const API_KEYS = new Set([
  process.env.API_KEY || "sinx-ultra-123"
]);

function checkApiKey(req) {
  const key = req.headers["x-api-key"];
  return key && API_KEYS.has(key);
}

/* ========================
   JWT SECRET
======================== */
const JWT_SECRET = process.env.JWT_SECRET || "sinx-secret";

/* ========================
   ROOT STATUS (ONLINE PAGE)
======================== */
app.get("/", (req, res) => {
  res.json({
    status: "ONLINE",
    system: "SINX ULTRA ENTERPRISE",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: "4.0.0"
  });
});

/* ========================
   METRICS DASHBOARD
======================== */
app.get("/metrics", (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: redis ? "redis" : "memory",
    status: "healthy"
  });
});

/* ========================
   AUTH: LOGIN -> JWT TOKEN
======================== */
app.post("/auth/login", (req, res) => {
  const { apiKey } = req.body;

  if (!API_KEYS.has(apiKey)) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const token = jwt.sign(
    { role: "client" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
});

/* ========================
   JWT VERIFY
======================== */
function verifyJWT(req) {
  const token = req.headers["authorization"];
  if (!token) return false;

  try {
    jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/* ========================
   SINX ENCODE CORE
======================== */
function sinxEncode(str, key = "SINX") {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    out += ("0" + code.toString(16)).slice(-2);
  }
  return out;
}

/* ========================
   API v1 (SECURED)
======================== */
app.get("/v1/api.php", async (req, res) => {
  const file = req.query.file;

  // MUST HAVE API KEY OR JWT
  if (!checkApiKey(req) && !verifyJWT(req)) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized"
    });
  }

  const cacheKey = `v1:${file}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    return res.json({
      status: "success",
      source: "cache",
      data: cached
    });
  }

  if (file === "assetindexer") {
    const data = {
      assets: [
        { id: 1, name: "weapon_ak47" },
        { id: 2, name: "skin_dragon" },
        { id: 3, name: "map_city" }
      ],
      ts: Date.now()
    };

    const encoded = sinxEncode(JSON.stringify(data));

    const response = {
      encoding: "sinx-ultra",
      payload: encoded
    };

    await setCache(cacheKey, response);

    return res.json({
      status: "success",
      source: "live",
      data: response
    });
  }

  return res.status(404).json({
    status: "error",
    message: "Not found"
  });
});

/* ========================
   GLOBAL ERROR HANDLER
======================== */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error"
  });
});

/* ========================
   START
======================== */
app.listen(PORT, () => {
  console.log(`🚀 SINX ULTRA ENTERPRISE ONLINE on ${PORT}`);
});