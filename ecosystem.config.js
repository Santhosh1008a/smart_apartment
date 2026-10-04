module.exports = {
  apps: [{
    name: "tdpcl-api",
    script: "./src/app.js",
    // The API starts scheduled jobs in-process. Keep one worker until a
    // separate scheduler or distributed leader lock prevents duplicate runs.
    instances: 1,
    exec_mode: "cluster",
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 5000
    }
  }]
}
