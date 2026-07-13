---
name: publicar
description: Publica Tastebox en el servidor de produccion mediante el script de deploy local del repositorio. Usar cuando el usuario escriba /publicar o pida publicar, deployar, desplegar, subir cambios o actualizar Tastebox en el servidor o en produccion.
---

# Publicar Tastebox

Ejecutar siempre el deploy desde la raiz del repositorio con:

```powershell
npm run deploy:prod
```

## Procedimiento

1. Confirmar que el directorio actual pertenece al repositorio Tastebox mediante `git rev-parse --show-toplevel` y cambiar a esa raiz.
2. Informar brevemente que comienza la publicacion en produccion.
3. Ejecutar `git status --short`. Si hay cambios sin commit, no ocultarlos ni descartarlos: detener el deploy y explicar que deben commitearse primero. No crear un commit salvo que el usuario tambien lo haya pedido.
4. Ejecutar `npm run deploy:prod` y esperar hasta que termine. No abandonar una sesion SSH o un proceso de deploy en ejecucion.
5. Si el script falla, revisar su salida y diagnosticar la causa. No reemplazar el flujo con comandos SSH manuales salvo para diagnosticar o reparar el propio deploy.
6. Cuando termine, comprobar:
   - `https://tastebox.beweb.com.ar` responde con HTTP 200.
   - `https://tastebox.beweb.com.ar/api/health` responde con `status: ok`.
7. Informar el resultado, la URL publicada y cualquier advertencia relevante.

## Reglas

- Considerar las expresiones "publicar", "deploy", "deployar", "desplegar" y "actualizar la app en el servidor" como una solicitud para ejecutar el script local, no como una consulta teorica.
- No ejecutar seed salvo que el usuario lo pida expresamente.
- No usar `-SkipPush` salvo que el usuario lo pida expresamente.
- Si falta la llave SSH, ejecutar `npm run deploy:setup-key` en una terminal interactiva y luego reintentar `npm run deploy:prod`.
- No mostrar contrasenas, llaves privadas, secretos, tokens, cookies ni encabezados de autenticacion.
- No declarar el deploy exitoso basandose solo en el build: exigir que el script finalice con codigo 0 y que las verificaciones publicas respondan correctamente.

