# 🚗 Sistema de Tickets Automotriz — Chevrolet Chilpancingo

Sistema web corporativo para gestión de recepción de vehículos, asignación de asesores y archivo de órdenes de servicio para **Chevrolet Chilpancingo (General Motors)**.

Desarrollado con **Node.js**, **Express**, **SQLite3** y **Vanilla JavaScript**, con diseño responsivo e identidad corporativa de alta gama (Chevrolet, GMC, Cadillac y Buick).

---

## 🏗️ Arquitectura del Sistema

| Componente | Tecnología / Descripción |
|------------|--------------------------|
| **Servidor Backend** | Node.js + Express (`server.js`) |
| **Base de Datos Local** | SQLite3 (`sistema_tickets.db`) con persistencia local |
| **Frontend Recepción** | HTML5, CSS3, Vanilla JS (`public/index.html`) |
| **Frontend Asesores** | HTML5, CSS3, Vanilla JS (`public/asesores.html`) |
| **Paleta Corporativa** | Azul Marino Oscuro (`#0d1b2a`), Azul GM (`#003366`), Dorado Chevrolet (`#c5a059`) |

---

## 🗄️ Esquema de Base de Datos (`sistema_tickets.db`)

El sistema gestiona automáticamente dos tablas principales:

### 1. `tickets_activos`
Gestiona los vehículos en espera o en atención actual:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `aQueViene`: Motivo de visita u orden previa
- `modelo`: Modelo del vehículo
- `anio`: Año del modelo
- `placa`: Placas vehiculares (mayúsculas)
- `vin`: Número de Serie VIN (validado estrictamente a 8 o 17 caracteres)
- `kilometraje`: Kilometraje actual
- `nombre`: Nombre del cliente
- `telefono`: Teléfono de contacto
- `email`: Correo electrónico
- `timestamp`: Marca de tiempo de llegada
- `asesor_asignado`: Nombre del asesor asignado (o NULL si está en espera)
- `estado`: `'espera'` o `'en_atencion'`
- `hora_atencion`: Marca de tiempo cuando fue tomado por un asesor

### 2. `historial_atencion`
Historial de citas y servicios terminados:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `id_fila_original`: Referencia al ID original en fila
- `numero_orden`: **Número de Orden obligatorio de 5 dígitos numéricos**
- `placa`, `vin`, `modelo`, `anio`, `kilometraje`
- `nombre`, `telefono`, `email`, `aQueViene`
- `hora_llegada`, `asesor_asignado`, `hora_terminado`

---

## 📡 API REST de Express

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/tickets` | Lista todos los tickets activos ordenados por llegada |
| `POST` | `/api/tickets` | Registra nuevo vehículo (valida VIN estrictamente a 8 o 17 caracteres) |
| `PUT` | `/api/tickets/:id/atender` | Asigna un asesor al ticket y cambia su estado a `en_atencion` |
| `POST` | `/api/tickets/cerrar` | Cierra el servicio requiriendo `numero_orden` (5 dígitos numéricos), archiva en historial y lo remueve de la fila activa |
| `GET` | `/api/historial` | Consulta todo el historial de servicios terminados ordenados cronológicamente |

---

## 🚀 Puesta en Marcha

### Prerrequisitos
- Node.js instalado (v16 o superior).

### Instalación y Ejecución
1. Abrir una terminal en el directorio del proyecto:
   ```bash
   npm install
   ```
2. Iniciar el servidor:
   ```bash
   npm start
   ```
   *(O alternativamente: `node server.js`)*

3. Abrir en el navegador:
   - **Recepción (Registro de vehículos):** [http://localhost:3000/index.html](http://localhost:3000/index.html)
   - **Tablero de Asesores:** [http://localhost:3000/asesores.html](http://localhost:3000/asesores.html)

> 💡 **Acceso en Red Local:** Si conectas otros dispositivos (tablets/smartphones en recepción) a la misma red Wi-Fi, pueden acceder usando la IP de tu computadora (ejemplo: `http://192.168.1.100:3000`).

---

## 🛡️ Reglas de Negocio Implementadas

1. **Validación Estricta de VIN (Número de Serie):**
   - El sistema únicamente permite registrar vehículos si el VIN tiene **exactamente 8 caracteres o exactamente 17 caracteres**.
   - Contador visual inteligente en tiempo real que cambia a verde únicamente con longitud válida.
2. **Número de Orden Obligatorio al Cerrar Servicio:**
   - Para finalizar una atención y archivarla, el asesor debe ingresar un Número de Orden de **exactamente 5 dígitos numéricos** (`/^\d{5}$/`).
3. **Historial General con Búsqueda y Separadores por Día:**
   - Buscador en tiempo real por Número de Orden o por VIN.
   - Separadores visuales organizados por fecha (`--- DD de Mes de AAAA ---`).
4. **Sistema de Acceso de Asesores:**
   - Modal de bloqueo inicial para selección de Asesor (Asesor 1, 2 o 3) con persistencia en `localStorage`.
   - Dos columnas independientes: *Fila de espera general* y *Mis clientes en atención*.
