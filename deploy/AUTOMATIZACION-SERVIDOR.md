# Automatización del servidor: cron, fail2ban y unattended-upgrades

Las tres piezas de automatización que corren en el servidor (`172.19.0.140`).
Cada una cumple un rol distinto: **una despliega, las otras dos defienden**.

## 1. El cron del servidor (el "vigilante" del deploy)

**Qué es cron**: un servicio que viene en todo Linux y ejecuta comandos en horarios
programados. Cada usuario tiene su lista de tareas (`crontab -l` para verla,
`crontab -e` para editarla). La sintaxis son 5 campos:
`minuto hora día mes día-de-semana` + el comando.

El usuario `deploy` tiene **dos tareas**:

```
*/3 * * * *  bash /opt/comercia/deploy/auto-deploy.sh   ← cada 3 minutos
0 3 * * *    bash /opt/comercia/deploy/backup.sh        ← todos los días a las 03:00
```

**La primera es la que reemplaza a Vercel.** Como el servidor está en red privada,
GitHub no puede "empujarle" los cambios — entonces el servidor **pregunta él mismo**
cada 3 minutos si hay algo nuevo. Lo que hace [auto-deploy.sh](auto-deploy.sh) en cada pasada:

1. **Lock** (`flock`): si la pasada anterior sigue corriendo (ej. bajando una imagen
   grande), esta se retira en silencio. Nunca hay dos deploys pisándose.
2. Anota la "huella digital" (**digest**) de las imágenes que están corriendo.
3. `docker compose pull`: le pregunta a GHCR si hay versión nueva de la API o el
   front. Si no hay nada nuevo, no baja nada (consulta liviana).
4. Compara digests: **si son iguales no hace absolutamente nada** (el 99% de las
   pasadas). Si cambió alguno → `docker compose up -d`, que recrea *solo* los
   contenedores cuya imagen cambió — y re-ejecuta el servicio `migrate`, así las
   migraciones de base de datos se aplican solas antes de levantar la API nueva.
5. Borra imágenes viejas (`docker image prune`) y deja registro en el log.

**Ver el log en vivo**: `ssh comercia` y después `tail -f ~/comercia-autodeploy.log`.

La segunda tarea guarda un `pg_dump` comprimido y un archivo del volumen de fotos en
`/opt/comercia/backups/`, verifica sus hashes y retiene 30 días ([backup.sh](backup.sh)).

## 2. fail2ban (el "portero" contra fuerza bruta)

El puerto 22 (SSH) está abierto en la red de la empresa. Cualquier máquina de esa
red (o un malware en la PC de un compañero) podría probar contraseñas de `root`
mil veces por minuto hasta acertar.

**fail2ban** es un servicio que lee los logs de autenticación (`/var/log/auth.log`)
en tiempo real y, cuando ve que una IP falló el login varias veces seguidas
(por defecto ~5 intentos en 10 minutos), **la banea**: agrega una regla de firewall
que le corta el acceso por un tiempo (10 min por defecto, escalando si reincide).
Al atacante le convierte "mil intentos por minuto" en "5 intentos cada 10 minutos" —
matemáticamente inviable.

Comandos útiles:

```bash
sudo fail2ban-client status sshd            # ver IPs baneadas ahora
sudo fail2ban-client set sshd unbanip <IP>  # desbanear (ej. si te bloqueaste vos)
```

## 3. unattended-upgrades (el "médico" de parches)

Ubuntu publica correcciones de seguridad casi todos los días (vulnerabilidades en
openssl, el kernel, sudo...). En un servidor que nadie administra a diario esos
parches no se instalan nunca — hasta que alguien explota el agujero.

**unattended-upgrades** revisa una vez al día (vía timers de systemd `apt-daily` y
`apt-daily-upgrade`) si hay actualizaciones **solo del canal de seguridad** y las
instala solo. No actualiza versiones mayores ni cambia configuraciones — únicamente
parches de seguridad. Su config vive en `/etc/apt/apt.conf.d/50unattended-upgrades`.

Dos aclaraciones importantes:

- **No reinicia el servidor solo** (por defecto). Si un parche de kernel requiere
  reboot, queda pendiente: existe `/var/run/reboot-required` cuando hace falta.
- **No toca los contenedores.** La API, el front y Postgres se actualizan por el
  pipeline (punto 1), no por apt. Son mundos separados.

## Cómo conviven — un día normal del servidor

| Cuándo | Qué pasa |
|---|---|
| Cada 3 min | auto-deploy pregunta a GHCR "¿hay imagen nueva?" — casi siempre no, y no pasa nada |
| Hacés `git push` | GitHub construye (~8 min) → en la siguiente pasada del cron el servidor se actualiza solo |
| Todo el día | fail2ban vigila los intentos de login y banea a quien insista |
| ~06:00 | unattended-upgrades instala los parches de seguridad del día |
| 03:00 | backup.sh respalda la base y rota los backups viejos |

La idea de fondo: que el servidor **no dependa de que alguien se acuerde de él** —
se actualiza, se defiende y se respalda solo. A vos te queda hacer `git push`.
