# Modelo 3D del jugador (duelo del hero)

**Nota:** La carga del modelo 3D externo se ha eliminado. La escena del hero
(`src/components/three/duel-scene.tsx`) usa siempre los maniquíes generados
por código (`FigureDuo`) con siluetas extruidas.

Si en el futuro se quiere recuperar el modelo glTF:
1. Colocar `player.glb` en `public/models/`
2. Revertir el componente `duel-scene.tsx` para reintroducir `PlayerModel` y el
   sistema de detección automática (`useGLTF` + `fetch` HEAD).
