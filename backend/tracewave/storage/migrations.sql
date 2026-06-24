-- Tracewave schema. Runs against TimescaleDB; degrades to plain Postgres tables
-- if the timescaledb extension / hypertable helpers are unavailable (the loader
-- executes each statement independently and tolerates timescale-only failures).

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS metrics (
    time              timestamptz      NOT NULL,
    source            text             NOT NULL DEFAULT 'wikimedia',
    rate              double precision NOT NULL,
    count             integer          NOT NULL,
    distinct_subjects integer          NOT NULL,
    distinct_actors   integer          NOT NULL,
    bot_ratio         double precision NOT NULL,
    bytes_per_sec     double precision NOT NULL,
    new_rate          double precision NOT NULL,
    detectors         jsonb            NOT NULL DEFAULT '[]',
    top               jsonb            NOT NULL DEFAULT '{}'
);

SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS anomalies (
    id           text             NOT NULL,
    time         timestamptz      NOT NULL,
    metric       text             NOT NULL,
    value        double precision NOT NULL,
    expected     double precision NOT NULL,
    severity     text             NOT NULL,
    score        double precision NOT NULL,
    agreement    integer          NOT NULL,
    detectors    jsonb            NOT NULL DEFAULT '[]',
    why          jsonb            NOT NULL DEFAULT '[]',
    window_start timestamptz,
    window_end   timestamptz,
    PRIMARY KEY (id, time)
);

SELECT create_hypertable('anomalies', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_metrics_time   ON metrics   (time DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_time ON anomalies (time DESC);

SELECT add_retention_policy('metrics', INTERVAL '7 days', if_not_exists => TRUE);
