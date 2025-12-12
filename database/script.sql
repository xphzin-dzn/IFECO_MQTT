CREATE DATABASE IF NOT EXISTS iot_projeto;
USE iot_projeto;

CREATE TABLE leituras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    velocidade FLOAT,
    tensao FLOAT,
    corrente FLOAT,
    temperatura FLOAT,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);