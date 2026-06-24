# Frontend UI/UX Best Practices: Anti-AI & High-Density Dashboards

## 1. Filosofía Principal (Anti-AI Slop)
El objetivo de este proyecto es construir una interfaz profesional, técnica y con alta densidad de datos. DEBES evitar los clichés típicos de los componentes generados por inteligencia artificial:
*   **Prohibido el "Default Dark Mode":** No utilices grises neutros (`slate`, `zinc`) combinados con brillos o gradientes morados/cyan genéricos. Usa paletas de color con tensión, contraste crudo y acentos asimétricos.
*   **Destruye las cajas:** No envuelvas cada métrica en una tarjeta (`<div className="rounded-xl border shadow-sm">`). Simplifica; muchas veces no necesitas ni una tarjeta ni un borde. 
*   **Densidad sobre minimalismo excesivo:** La interfaz debe mostrar múltiples puntos de datos organizados por una jerarquía visual clara basada en el tamaño y el espaciado, no en separadores visuales redundantes.

## 2. Fuentes de Verdad y Componentes
Cuando necesites implementar elementos interactivos complejos, animaciones CSS o micro-interacciones, DEBES inspirarte o adaptar código de las siguientes fuentes:
*   **Uiverse (https://uiverse.io/):** Utiliza este recurso para buscar botones táctiles, *loaders* o *inputs* con HTML/CSS puro que rompan la monotonía de las librerías de componentes tradicionales.
*   **Pro-Max Skills (https://ui-ux-pro-max-skill.nextlevelbuilder.io/):** Aplica los patrones avanzados de diseño dictados en esta documentación.

## 3. Jerarquía y Tipografía
*   **Tipografía Técnica:** Evita usar 'Inter' o 'Geist' de forma aislada. Utiliza fuentes Grotesque para encabezados y reserva ESTRICTAMENTE tipografías monoespaciadas para cualquier tabla, métrica o porcentaje estadístico.
*   **Asimetría Intencional:** Para elementos destacados, utiliza un balance asimétrico en la composición. Coloca elementos clave fuera del centro para guiar el ojo y crear tensión visual.

## 4. Priorización de Datos
*   **Filtros y Drill-downs:** El usuario debe poder profundizar en la información. Agrupa métricas relacionadas y elimina cualquier elemento decorativo que no aporte valor a la toma de decisiones.
*   **Ocultar lo secundario:** No todo necesita estar a la vista. Es preferible ocultar acciones secundarias en menús contextuales o *tooltips* interactivos para reducir el ruido visual.