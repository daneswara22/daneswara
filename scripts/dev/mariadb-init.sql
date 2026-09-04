CREATE DATABASE IF NOT EXISTS `default` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'daneswara'@'%' IDENTIFIED BY 'daneswara_dev';
CREATE USER IF NOT EXISTS 'daneswara'@'localhost' IDENTIFIED BY 'daneswara_dev';
GRANT ALL PRIVILEGES ON `default`.* TO 'daneswara'@'%';
GRANT ALL PRIVILEGES ON `default`.* TO 'daneswara'@'localhost';
FLUSH PRIVILEGES;
