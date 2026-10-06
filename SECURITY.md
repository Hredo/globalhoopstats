# Security policy

**English** · [Español](#política-de-seguridad)

## Supported versions

Only what runs on [globalhoopstats.es](https://globalhoopstats.es) — the `master` branch —
receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately, in either of these ways:

1. **GitHub** — the [Security tab](https://github.com/Hredo/globalhoopstats/security) →
   **Report a vulnerability**
   ([direct link](https://github.com/Hredo/globalhoopstats/security/advisories/new)).
   Only the maintainer can see it.
2. **Email** — hrvaldes22@gmail.com, with `[security] globalhoopstats` in the subject.

It helps to include:

- the page or API route affected and what an attacker can do with it;
- what the attacker needs first (an account, a victim's click, network position…);
- the steps to reproduce it, or a proof of concept.

You will get an answer as soon as possible, and you will be told whether the report is
accepted, what the fix will be and when it ships. If you want to be credited, say so.

## Rules for testing

- Use **your own account**. Never access, change or delete another person's data.
- No denial-of-service, load testing, spam through the contact or sign-up forms, or social
  engineering.
- Do not run automated scanners against production at volume — the site sits behind
  Cloudflare and they will be blocked anyway.
- Stop and report as soon as you have shown the problem; do not pivot from it.

Good-faith research that follows these rules will not be pursued.

## Scope

**In scope:** the web application and its API — authentication, sessions and 2FA,
authorization between accounts, the admin area, how users' AI keys are stored (AES-256-GCM
at rest), the AI surfaces (prompt injection that crosses an account boundary or reaches
another user), XSS, CSRF, open redirects and SSRF.

**Out of scope:** the third-party AI providers and the leagues' own websites (report to
them), Cloudflare and Hostinger infrastructure, missing best-practice headers with no
demonstrated impact, and reports from automated tools without a working proof.

The controls that are meant to hold are described in
[docs/ARCHITECTURE.en.md § 9](docs/ARCHITECTURE.en.md#9-authentication--security); a way
around any of them counts as a vulnerability.

---

# Política de seguridad

[English](#security-policy) · **Español**

## Versiones con soporte

Solo lo que corre en [globalhoopstats.es](https://globalhoopstats.es) —la rama `master`—
recibe arreglos de seguridad.

## Cómo avisar de una vulnerabilidad

**No abras un issue público.** Avisa en privado, de cualquiera de estas dos formas:

1. **GitHub** — [pestaña Security](https://github.com/Hredo/globalhoopstats/security) →
   **Report a vulnerability**
   ([enlace directo](https://github.com/Hredo/globalhoopstats/security/advisories/new)).
   Solo lo ve el responsable.
2. **Correo** — hrvaldes22@gmail.com, con `[security] globalhoopstats` en el asunto.

Ayuda mucho incluir:

- la página o ruta de la API afectada y qué puede hacer un atacante con ello;
- qué necesita antes el atacante (una cuenta, un clic de la víctima, estar en su red…);
- los pasos para reproducirlo o una prueba de concepto.

Recibirás respuesta lo antes posible, y se te dirá si el aviso se acepta, cuál será el
arreglo y cuándo sale. Si quieres aparecer en los agradecimientos, dilo.

## Normas para probar

- Usa **tu propia cuenta**. Nunca accedas, cambies ni borres datos de otra persona.
- Nada de denegación de servicio, pruebas de carga, spam por los formularios de contacto o
  registro, ni ingeniería social.
- No lances escáneres automáticos contra producción a lo bruto: la web está detrás de
  Cloudflare y los va a bloquear igualmente.
- Para y avisa en cuanto hayas demostrado el fallo; no sigas a partir de él.

La investigación de buena fe que siga estas normas no tendrá consecuencias.

## Qué entra

**Entra:** la aplicación web y su API —autenticación, sesiones y 2FA, autorización entre
cuentas, el panel de administración, cómo se guardan las claves de IA de los usuarios
(AES-256-GCM en reposo), las funciones de IA (inyección de instrucciones que cruce de una
cuenta a otra o llegue a otro usuario), XSS, CSRF, redirecciones abiertas y SSRF.

**No entra:** los proveedores de IA de terceros y las webs de las ligas (avísales a ellos),
la infraestructura de Cloudflare y Hostinger, cabeceras de buenas prácticas sin un impacto
demostrado e informes de herramientas automáticas sin una prueba que funcione.

Las protecciones que deben aguantar están descritas en
[docs/ARCHITECTURE.es.md § 9](docs/ARCHITECTURE.es.md); saltarse cualquiera de ellas cuenta
como vulnerabilidad.
