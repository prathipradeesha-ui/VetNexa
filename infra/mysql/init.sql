-- Development only: lets the application user create and drop the Prisma shadow database
-- and a separate database used by automated tests.
GRANT ALL PRIVILEGES ON *.* TO 'vetnexa'@'%';
FLUSH PRIVILEGES;
