create database JobNest;
go;
use JobNest;
go;


CREATE TABLE Estados (
    id int identity (1,1),
    Nombre VARCHAR(150),
    PRIMARY KEY(id)
);

CREATE TABLE Municipios (
    id int identity (1,1),
    EstadoId INT,
    Nombre VARCHAR(150),
    PRIMARY KEY(id),
    FOREIGN KEY (EstadoId) REFERENCES Estados(id)
);

CREATE TABLE Colonias (
    id int identity (1,1),
    MunicipioId INT,
    Nombre VARCHAR(150),
    PRIMARY KEY(id),
    FOREIGN KEY (MunicipioId) REFERENCES Municipios(id)
);

CREATE TABLE Calles (
    id int identity (1,1),
    ColoniaId INT,
    Nombre VARCHAR(150),
    PRIMARY KEY(id),
    FOREIGN KEY (ColoniaId) REFERENCES Colonias(id)
);

CREATE TABLE Direcciones (
    id int identity (1,1),
    CalleId INT,
    NumeroExt VARCHAR(20),
    NumeroInt VARCHAR(20),
    CP VARCHAR(10),
    Referencia VARCHAR(255),
    PRIMARY KEY(id),
    FOREIGN KEY (CalleId) REFERENCES Calles(id)
);

CREATE TABLE Roles (
    id int identity (1,1),
    Nombre VARCHAR(100),
    PRIMARY KEY(id)
);

select * from Roles

CREATE TABLE Usuarios(
    id int identity (1,1),
    Email VARCHAR(150),
    PasswordHash VARCHAR(255),
    Activo TINYINT,
    CreadoEn DATETIME,
    UltimoLogin DATETIME,
    PRIMARY KEY(id)
);

SELECT * from Usuarios;


CREATE TABLE Personas (
    id int identity (1,1),
    UsuarioId INT,
    Nombre VARCHAR(100),
    ApellidoP VARCHAR(100),
    ApellidoM VARCHAR(100),
    Telefono VARCHAR(30),
    PRIMARY KEY(id),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
);

SELECT * from Personas;


CREATE TABLE UsuarioRoles (
    UsuarioId INT,
    RolId INT,
    PRIMARY KEY(UsuarioId, RolId),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id),
    FOREIGN KEY (RolId) REFERENCES Roles(id)
);

CREATE TABLE UsuarioDirecciones (
    UsuarioId INT,
    DireccionId INT,
    Tipo VARCHAR(30),
    Principal TINYINT,
    PRIMARY KEY (UsuarioId, DireccionId),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id),
    FOREIGN KEY (DireccionId) REFERENCES Direcciones(id)
);

SELECT * from UsuarioDirecciones;


CREATE TABLE Categorias (
    id int identity (1,1),
    Nombre VARCHAR(150),
    ParentId INT NULL,
    PRIMARY KEY(id),
    FOREIGN KEY (ParentId) REFERENCES Categorias(id)
);

SELECT * from Categorias;


CREATE TABLE Habilidades (
    id int identity (1,1),
    Nombre VARCHAR(150),
    PRIMARY KEY(id)
);

SELECT * from Habilidades;


CREATE TABLE Prestadores (
    id int identity (1,1),
    UsuarioId INT,
    CategoriaId INT NULL,
    Bio TEXT,
    TarifaBase DECIMAL(10,2),
    Verificado TINYINT,
    RatingPromedio DECIMAL(3,2),
    TotalResenas INT,
    PRIMARY KEY(id),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id),
    FOREIGN KEY (CategoriaId) REFERENCES Categorias(id)
);



CREATE TABLE PrestadorHabilidades (
    PrestadorId INT,
    HabilidadId INT,
    PRIMARY KEY (PrestadorId, HabilidadId),
    FOREIGN KEY (PrestadorId) REFERENCES Prestadores(id),
    FOREIGN KEY (HabilidadId) REFERENCES Habilidades(id)
);


CREATE TABLE Disponibilidad (
    id int identity (1,1),
    PrestadorId INT,
    DiaSemana TINYINT,
    HoraInicio TIME,
    HoraFin TIME,
    PRIMARY KEY(id),
    FOREIGN KEY (PrestadorId) REFERENCES Prestadores(id)
);

CREATE TABLE Planes (
    id int identity (1,1),
    Nombre VARCHAR(50),
    CostoAnual DECIMAL(10,2),
    ComisionPct DECIMAL(5,2),
    LimiteServicios INT,
    CoberturaKM INT,
    VisibilidadRank INT,
    PRIMARY KEY(id)
);

CREATE TABLE Suscripciones (
    id int identity (1,1),
    PrestadorId INT,
    PlanId INT,
    FechaInicio DATE,
    FechaFin DATE,
    Activo TINYINT,
    PRIMARY KEY(id),
    FOREIGN KEY (PrestadorId) REFERENCES Prestadores(id),
    FOREIGN KEY (PlanId) REFERENCES Planes(id)
);

CREATE TABLE Estatus (
    id int identity (1,1),
    Nombre VARCHAR(100),
    PRIMARY KEY(id)
);

CREATE TABLE Solicitudes (
    id int identity (1,1),
    ClienteId INT NULL,
    CategoriaId INT,
    DireccionId INT,
    Titulo VARCHAR(150),
    Descripcion TEXT,
    PresupuestoMin DECIMAL(10,2),
    PresupuestoMax DECIMAL(10,2),
    EstatusId INT,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (ClienteId) REFERENCES Usuarios(id),
    FOREIGN KEY (CategoriaId) REFERENCES Categorias(id),
    FOREIGN KEY (DireccionId) REFERENCES Direcciones(id),
    FOREIGN KEY (EstatusId) REFERENCES Estatus(id)
);

CREATE TABLE Cotizaciones (
    id int identity (1,1),
    SolicitudId INT,
    PrestadorId INT,
    Monto DECIMAL(10,2),
    Mensaje TEXT,
    ValidaHasta DATETIME,
    EstatusId INT,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (SolicitudId) REFERENCES Solicitudes(id),
    FOREIGN KEY (PrestadorId) REFERENCES Prestadores(id),
    FOREIGN KEY (EstatusId) REFERENCES Estatus(id)
);

CREATE TABLE Ordenes (
    id int identity (1,1),
    CotizacionId INT,
    EstatusId INT,
    ProgramadoEn DATETIME,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (CotizacionId) REFERENCES Cotizaciones(id),
    FOREIGN KEY (EstatusId) REFERENCES Estatus(id)
);

CREATE TABLE Trabajos (
    id int identity (1,1),
    OrdenId INT,
    Inicio DATETIME,
    Fin DATETIME,
    Notas TEXT,
    PRIMARY KEY(id),
    FOREIGN KEY (OrdenId) REFERENCES Ordenes(id)
);

CREATE TABLE MetodosPago (
    id int identity (1,1),
    Nombre VARCHAR(50),
    PRIMARY KEY(id)
);

CREATE TABLE Pagos (
    id int identity (1,1),
    OrdenId INT,
    Monto DECIMAL(10,2),
    Moneda CHAR(3),
    MetodoId INT,
    EstatusId INT,
    Procesador VARCHAR(50),
    ProcesadorChargeId VARCHAR(100),
    PagadoEn DATETIME,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (OrdenId) REFERENCES Ordenes(id),
    FOREIGN KEY (MetodoId) REFERENCES MetodosPago(id),
    FOREIGN KEY (EstatusId) REFERENCES Estatus(id)
);

CREATE TABLE Resenas (
    id int identity (1,1),
    OrdenId INT,
    RevisorId INT NULL,
    EvaluadoId INT NULL,
    Calificacion TINYINT,
    Comentario TEXT,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (OrdenId) REFERENCES Ordenes(id),
    FOREIGN KEY (RevisorId) REFERENCES Usuarios(id),
    FOREIGN KEY (EvaluadoId) REFERENCES Usuarios(id)
);

CREATE TABLE Hilos (
    id int identity (1,1),
    SolicitudId INT,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (SolicitudId) REFERENCES Solicitudes(id)
);

CREATE TABLE Mensajes (
    id int identity (1,1),
    HiloId INT,
    EmisorId INT NULL,
    Cuerpo TEXT,
    EnviadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (HiloId) REFERENCES Hilos(id),
    FOREIGN KEY (EmisorId) REFERENCES Usuarios(id)
);

SELECT * from Mensajes;

CREATE TABLE TiposVerificacion (
    id int identity (1,1),
    Nombre VARCHAR(100),
    PRIMARY KEY(id)
);

SELECT * from TiposVerificacion;

CREATE TABLE Verificaciones (
    id int identity (1,1),
    PrestadorId INT,
    TipoId INT,
    EstatusId INT,
    DocumentoUrl VARCHAR(255),
    RevisadoPor INT NULL,
    RevisadoEn DATETIME,
    CreadoEn DATETIME,
    PRIMARY KEY(id),
    FOREIGN KEY (PrestadorId) REFERENCES Prestadores(id),
    FOREIGN KEY (TipoId) REFERENCES TiposVerificacion(id),
    FOREIGN KEY (EstatusId) REFERENCES Estatus(id),
    FOREIGN KEY (RevisadoPor) REFERENCES Usuarios(id)
);

select * from Verificaciones

-- Crear tabla de Publicaciones
CREATE TABLE Publicaciones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioId INT NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    Descripcion TEXT,
    Categoria NVARCHAR(100) NOT NULL,
    Precio DECIMAL(10,2),
    Ubicacion NVARCHAR(255),
    Experiencia INT,
    Habilidades NVARCHAR(500),
    Disponibilidad NVARCHAR(100),
    IncluyeMateriales BIT DEFAULT 0,
    FechaCreacion DATETIME DEFAULT GETDATE(),
    Activa BIT DEFAULT 1,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(id)
);

ALTER TABLE Publicaciones ADD TipoPrecio NVARCHAR(20) DEFAULT 'Por día';

select * from Publicaciones


CREATE TABLE SolicitudesServicios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    PublicacionId INT NOT NULL,
    ClienteId INT NOT NULL,
    PrestadorId INT NOT NULL,
    FechaSolicitud DATETIME DEFAULT GETDATE(),
    FechaServicio DATE NOT NULL,
    HoraServicio TIME,
    MensajeCliente TEXT,
    Estado NVARCHAR(50) DEFAULT 'pendiente',
    FOREIGN KEY (PublicacionId) REFERENCES Publicaciones(id),
    FOREIGN KEY (ClienteId) REFERENCES Usuarios(id),
    FOREIGN KEY (PrestadorId) REFERENCES Usuarios(id)
);

-- Agregar columna para fecha de aceptación en SolicitudesServicios
ALTER TABLE SolicitudesServicios ADD FechaAceptacion DATETIME;

-- También vamos a agregar una tabla para eventos de agenda si no existe
CREATE TABLE EventosAgenda (
    id INT IDENTITY(1,1) PRIMARY KEY,
    PrestadorId INT NOT NULL,
    SolicitudId INT,
    Titulo NVARCHAR(255) NOT NULL,
    Descripcion TEXT,
    FechaInicio DATETIME NOT NULL,
    FechaFin DATETIME,
    TipoEvento NVARCHAR(50) DEFAULT 'trabajo',
    Estado NVARCHAR(50) DEFAULT 'programado',
    FechaCreacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (PrestadorId) REFERENCES Usuarios(id),
    FOREIGN KEY (SolicitudId) REFERENCES SolicitudesServicios(id)
);
