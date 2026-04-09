USE packman;

CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  rut VARCHAR(20),
  direccion VARCHAR(500),
  ciudad VARCHAR(100),
  telefono VARCHAR(50),
  email VARCHAR(255),
  contacto_principal VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE maquinas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  nombre VARCHAR(255) NOT NULL,
  modelo VARCHAR(100),
  serie VARCHAR(100),
  ubicacion VARCHAR(255),
  fecha_instalacion DATE,
  estado VARCHAR(50) DEFAULT 'operativa',
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE equipos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  maquina_id INT,
  nombre VARCHAR(255) NOT NULL,
  modelo VARCHAR(100),
  descripcion TEXT,
  FOREIGN KEY (maquina_id) REFERENCES maquinas(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE repuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(12,2) DEFAULT 0,
  equipo_id INT,
  categoria VARCHAR(100),
  FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repuesto_id INT,
  stock INT DEFAULT 0,
  stock_minimo INT DEFAULT 5,
  ubicacion_bodega VARCHAR(50),
  ultimo_ingreso DATE,
  FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tecnicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  especialidad VARCHAR(255),
  telefono VARCHAR(50),
  email VARCHAR(255),
  activo TINYINT DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE reportes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tecnico_id INT,
  maquina_id INT,
  fecha DATE DEFAULT (CURDATE()),
  tipo VARCHAR(50) DEFAULT 'inspección',
  descripcion TEXT,
  hallazgos TEXT,
  recomendaciones TEXT,
  estado VARCHAR(50) DEFAULT 'pendiente',
  prioridad VARCHAR(50) DEFAULT 'media',
  FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id) ON DELETE SET NULL,
  FOREIGN KEY (maquina_id) REFERENCES maquinas(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE temporadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  estado VARCHAR(50) DEFAULT 'planificada',
  descripcion TEXT
) ENGINE=InnoDB;

CREATE TABLE informes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporte_id INT,
  temporada_id INT,
  titulo VARCHAR(500) NOT NULL,
  resumen TEXT,
  hallazgos_detallados TEXT,
  recomendaciones_detalladas TEXT,
  fecha_emision DATE DEFAULT (CURDATE()),
  estado VARCHAR(50) DEFAULT 'borrador',
  FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE SET NULL,
  FOREIGN KEY (temporada_id) REFERENCES temporadas(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE cubicaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  temporada_id INT,
  informe_id INT,
  titulo VARCHAR(500),
  fecha DATE DEFAULT (CURDATE()),
  estado VARCHAR(50) DEFAULT 'borrador',
  total DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (temporada_id) REFERENCES temporadas(id) ON DELETE SET NULL,
  FOREIGN KEY (informe_id) REFERENCES informes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE cubicacion_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cubicacion_id INT,
  repuesto_id INT,
  cantidad INT DEFAULT 1,
  precio_unitario DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (cubicacion_id) REFERENCES cubicaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ══════════════ DATOS DE EJEMPLO ══════════════

INSERT INTO clientes (nombre,rut,direccion,ciudad,telefono,email,contacto_principal) VALUES
  ('Procesadora de Nueces del Sur S.A.','76.543.210-K','Av. Industrial 1520','Rancagua','+56 72 234 5678','contacto@nuecesdelsur.cl','Roberto Mendoza'),
  ('Agrícola Valle Central Ltda.','77.891.234-5','Camino El Olivar km 3','San Fernando','+56 72 345 6789','info@vallecentralag.cl','Patricia Soto'),
  ('Frutos Secos Premium SpA','76.234.567-8','Ruta 5 Sur km 142','Requínoa','+56 72 456 7890','gerencia@frutossecospremium.cl','Andrés Villalobos'),
  ('Exportadora Nutchile S.A.','78.123.456-7','Parque Industrial Lote 8','Los Andes','+56 34 567 8901','operaciones@nutchile.cl','María Fernández'),
  ('Cooperativa Agrícola La Nogalera','75.456.789-0','Av. Bernardo OHiggins 890','Curicó','+56 75 678 9012','admin@lanogalera.cl','Jorge Contreras');

INSERT INTO maquinas (cliente_id,nombre,modelo,serie,ubicacion,fecha_instalacion,estado) VALUES
  (1,'Descascaradora','KR-500','KR500-2021-001','Línea 1 - Planta Principal','2021-03-15','operativa'),
  (1,'Calibradora','LC-300','LC300-2021-002','Línea 1 - Post Descascarado','2021-03-20','operativa'),
  (1,'Secador Industrial','SI-1000','SI1000-2020-005','Zona de Secado','2020-11-10','en mantención'),
  (2,'Descascaradora','KR-500','KR500-2022-003','Planta A','2022-01-10','operativa'),
  (2,'Seleccionadora Óptica','SO-200','SO200-2022-001','Planta A - Selección','2022-02-15','operativa'),
  (3,'Descascaradora','KR-750','KR750-2023-001','Línea Principal','2023-04-01','operativa'),
  (3,'Calibradora','LC-500','LC500-2023-002','Post Proceso','2023-04-10','operativa'),
  (4,'Línea Completa de Proceso','LCP-2000','LCP2000-2022-001','Nave Industrial 1','2022-06-01','operativa'),
  (4,'Envasadora al Vacío','EV-100','EV100-2022-005','Zona de Empaque','2022-07-15','detenida'),
  (5,'Descascaradora','KR-500','KR500-2021-008','Galpón Central','2021-08-20','operativa');

INSERT INTO equipos (maquina_id,nombre,modelo,descripcion) VALUES
  (1,'Motor Principal','WEG W22 15HP','Motor eléctrico trifásico principal'),
  (1,'Sistema Hidráulico','Parker PVP-16','Unidad hidráulica de presión para rodillos'),
  (1,'Cinta Transportadora','CT-KR-01','Cinta de alimentación de nueces'),
  (2,'Zaranda Vibratoria','ZV-LC-01','Sistema de vibración para calibrado'),
  (2,'Motor Vibratorio','MVE 300/3','Motor de vibración de zaranda'),
  (3,'Quemador a Gas','QG-SI-01','Quemador industrial para secado'),
  (3,'Ventilador Centrífugo','VC-SI-01','Ventilador para circulación de aire caliente'),
  (6,'Motor Principal','WEG W22 20HP','Motor eléctrico trifásico de alta potencia'),
  (6,'Sistema de Cuchillas','SC-KR750-01','Conjunto de cuchillas para descascarado'),
  (8,'PLC Central','Siemens S7-1200','Controlador lógico programable de línea');

INSERT INTO repuestos (codigo,nombre,descripcion,precio,equipo_id,categoria) VALUES
  ('ROD-SKF-6205','Rodamiento SKF 6205-2RS','Rodamiento rígido de bolas sellado',15500,1,'Rodamientos'),
  ('ROD-SKF-6208','Rodamiento SKF 6208-2RS','Rodamiento rígido de bolas sellado grande',28900,1,'Rodamientos'),
  ('COR-GT3-8M','Correa Dentada GT3-8M-1200','Correa de transmisión dentada',45000,1,'Transmisión'),
  ('FIL-HID-40','Filtro Hidráulico HF-40','Filtro de presión para sistema hidráulico',32000,2,'Filtros'),
  ('ACE-HID-68','Aceite Hidráulico ISO 68 (20L)','Aceite hidráulico alto rendimiento',65000,2,'Lubricantes'),
  ('BAN-CONV-01','Banda Transportadora 500mm x 5m','Banda de PVC para cinta transportadora',185000,3,'Cintas'),
  ('RES-ZAR-01','Resorte de Zaranda Ø50x200','Resorte helicoidal para soporte de zaranda',22000,4,'Resortes'),
  ('MAL-VIB-01','Malla Vibratoria #8 1200x600','Malla de acero para calibrado',55000,4,'Mallas'),
  ('BUJ-QUE-01','Bujía de Encendido Industrial','Bujía para quemador a gas',18500,6,'Combustión'),
  ('FIL-AIR-01','Filtro de Aire Industrial 300x300','Filtro para ventilador centrífugo',28000,7,'Filtros'),
  ('CUC-KR750-01','Juego Cuchillas KR-750 (4pcs)','Set de cuchillas de descascarado',320000,9,'Cuchillas'),
  ('SEL-RET-01','Sello Retén 45x65x10','Sello de retén para eje principal',8500,1,'Sellos'),
  ('RUE-GUI-01','Rueda Guía Ø80','Rueda guía para cinta transportadora',12000,3,'Guías'),
  ('SEN-TEMP-01','Sensor de Temperatura PT100','Sensor RTD para control de temperatura',42000,6,'Sensores'),
  ('CON-SIE-01','Contactor Siemens 3RT2026','Contactor de potencia 25A',55000,10,'Eléctricos');

INSERT INTO inventario (repuesto_id,stock,stock_minimo,ubicacion_bodega,ultimo_ingreso) VALUES
  (1,24,10,'A-01-03','2026-01-15'),(2,8,5,'A-01-04','2025-12-20'),
  (3,6,3,'B-02-01','2026-02-10'),(4,12,5,'C-01-01','2026-01-28'),
  (5,4,2,'D-01-01','2025-11-15'),(6,2,1,'E-01-01','2025-10-05'),
  (7,18,8,'A-02-01','2026-03-01'),(8,5,3,'B-01-01','2026-02-15'),
  (9,15,5,'C-02-01','2026-03-10'),(10,10,4,'C-02-02','2026-01-20'),
  (11,3,2,'F-01-01','2025-09-15'),(12,30,10,'A-01-05','2026-03-15'),
  (13,12,5,'A-03-01','2026-02-28'),(14,6,3,'C-03-01','2026-03-05'),
  (15,8,4,'G-01-01','2026-01-10');

INSERT INTO tecnicos (nombre,especialidad,telefono,email) VALUES
  ('Carlos Gutiérrez','Mecánica Industrial','+56 9 8765 4321','cgutierrez@packman.cl'),
  ('Luis Morales','Electricidad y Automatización','+56 9 7654 3210','lmorales@packman.cl'),
  ('Diego Araya','Hidráulica','+56 9 6543 2109','daraya@packman.cl'),
  ('Francisco Rojas','Mecánica General','+56 9 5432 1098','frojas@packman.cl');

INSERT INTO temporadas (nombre,fecha_inicio,fecha_fin,estado,descripcion) VALUES
  ('Temporada 2025','2025-02-01','2025-05-31','finalizada','Mantención pre-temporada cosecha 2025'),
  ('Temporada 2026','2026-02-01','2026-05-31','en curso','Mantención pre-temporada cosecha 2026'),
  ('Inter-Temporada 2026','2026-06-01','2026-09-30','planificada','Mantenciones preventivas periodo entre cosechas');

INSERT INTO reportes (tecnico_id,maquina_id,fecha,tipo,descripcion,hallazgos,recomendaciones,estado,prioridad) VALUES
  (1,1,'2026-03-10','inspección','Inspección rutinaria descascaradora KR-500',
   'Desgaste en rodamientos del eje principal. Vibración por encima de lo normal. Correa con grietas visibles.',
   'Reemplazo inmediato de rodamientos SKF 6205. Programar cambio de correa GT3-8M.','pendiente','alta'),
  (2,3,'2026-03-12','correctivo','Falla en control de temperatura del secador',
   'Sensor PT100 con lecturas erróneas. Contactor de ventilador con desgaste. Quemador enciende intermitente.',
   'Reemplazar sensor PT100. Cambiar contactor Siemens 3RT2026. Limpieza de bujías.','en proceso','crítica'),
  (3,2,'2026-03-15','inspección','Revisión sistema hidráulico calibradora LC-300',
   'Filtro hidráulico saturado. Aceite con partículas metálicas. Presión 5% bajo especificación.',
   'Cambio filtro HF-40. Flush completo y cambio de aceite. Re-calibrar válvula de presión.','pendiente','media'),
  (4,5,'2026-03-18','preventivo','Mantención preventiva seleccionadora óptica SO-200',
   'Lentes con polvo. Sistema de aire comprimido OK. Software actualizado.',
   'Limpieza de óptica con protocolo del fabricante. Siguiente mantención en 3 meses.','completado','baja'),
  (1,6,'2026-03-20','inspección','Inspección pre-temporada descascaradora KR-750',
   'Cuchillas con desgaste del 60%. Motor principal en buen estado. Requiere ajuste de torque.',
   'Programar cambio de cuchillas para inicio de temporada. Ajustar torque.','pendiente','alta'),
  (2,8,'2026-03-22','preventivo','Revisión PLC y sistema eléctrico línea completa',
   'PLC operando correctamente. Programa de respaldo actualizado. 2 contactores al 70%.',
   'Mantener monitoreo de contactores. Respaldo PLC mensual.','completado','baja');

INSERT INTO informes (reporte_id,temporada_id,titulo,resumen,hallazgos_detallados,recomendaciones_detalladas,fecha_emision,estado) VALUES
  (1,2,'Informe Técnico - Descascaradora KR-500 Nueces del Sur',
   'Desgastes críticos en transmisión requieren intervención antes de temporada.',
   '1. RODAMIENTOS: SKF 6205-2RS con juego axial excesivo. Vida útil remanente: 200 hrs.\n2. CORREA: GT3-8M-1200 con grietas en 3 dientes. Riesgo de rotura a carga completa.\n3. VIBRACIÓN: 4.2 mm/s RMS (límite: 3.5 mm/s).',
   '1. ALTA: Reemplazo rodamientos SKF 6205-2RS (2 uds).\n2. ALTA: Cambio correa GT3-8M-1200 (1 ud).\n3. Balanceo dinámico post-cambio.\n4. Análisis vibracional de seguimiento a 48 hrs.\n\nTiempo estimado: 8 horas.\nCosto repuestos: $76.000 CLP.',
   '2026-03-12','emitido'),
  (2,2,'Informe Técnico - Secador Industrial SI-1000 Nueces del Sur',
   'Fallas múltiples en control térmico requieren intervención correctiva urgente.',
   '1. SENSOR PT100: Desviación ±15°C. Daño en vaina por condensación.\n2. CONTACTOR: Siemens 3RT2026 con picaduras severas en contactos.\n3. QUEMADOR: Bujías con carbonilla, arranques fallidos.',
   '1. URGENTE: Reemplazo sensor PT100 y verificación cableado.\n2. URGENTE: Cambio contactor Siemens 3RT2026.\n3. Limpieza/reemplazo bujías (2 uds).\n4. Prueba lazo de control.\n\nTiempo estimado: 6 horas.\nCosto repuestos: $115.500 CLP.',
   '2026-03-14','emitido');

INSERT INTO cubicaciones (temporada_id,informe_id,titulo,fecha,estado,total) VALUES
  (2,1,'Cubicación Mantención KR-500 - Temporada 2026','2026-03-13','aprobada',76000),
  (2,2,'Cubicación Correctivo Secador SI-1000','2026-03-14','aprobada',115500);

INSERT INTO cubicacion_items (cubicacion_id,repuesto_id,cantidad,precio_unitario) VALUES
  (1,1,2,15500),(1,3,1,45000),
  (2,14,1,42000),(2,15,1,55000),(2,9,2,18500);
