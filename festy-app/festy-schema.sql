
CREATE TABLE users (
    
);

-- CREATE TABLE festivals (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     start_date DATE NOT NULL,
--     end_date DATE NOT NULL,
--     location VARCHAR(255) NOT NULL,
--     description TEXT NOT NULL,
--     image_url VARCHAR(255) NOT NULL,
--     website_url VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
-- );

-- CREATE TABLE artists (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     description TEXT NOT NULL,
--     image_url VARCHAR(255) NOT NULL,
--     website_url VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
-- );
-- CREATE TABLE acts (
--     id SERIAL PRIMARY KEY,
--     festival_id INTEGER
--         REFERENCES festivals(id),
--     artist_id INTEGER
--         REFERENCES artists(id),
--     created_at TIMESTAMP NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
-- );

-- CREATE TABLE divdata(
--     id SERIAL PRIMARY KEY,
--     act_id INTEGER REFERENCES acts(id),
--     left INTEGER NOT NULL,
--     top INTEGER NOT NULL,
--     width INTEGER NOT NULL,
--     height INTEGER NOT NULL,
-- );