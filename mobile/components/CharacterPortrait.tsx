import { useEffect, useState } from "react";
import { View } from "react-native";
import { Canvas, Picture, Skia, type SkImage, type SkPicture } from "@shopify/react-native-skia";

import { getCharacter } from "@/src/characters/registry";
import { getAnim } from "@/src/engine/character";
import { loadAtlas } from "@/src/game/atlas";

type Props = { readonly id: string; readonly size: number; readonly flip?: boolean; readonly anim?: number };

/** Desenha o primeiro frame de uma animação do personagem (padrão: 0, parado). */
export function CharacterPortrait({ id, size, flip, anim = 0 }: Props) {
  const [images, setImages] = useState<SkImage[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadAtlas(id).then((imgs) => alive && setImages(imgs));
    return () => {
      alive = false;
    };
  }, [id]);

  let picture: SkPicture | null = null;
  try {
    const ch = getCharacter(id);
    const frame = getAnim(ch, anim).frames[0];
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const entry = ch.sprites?.frames[`${frame.group},${frame.index}`];
    const img = entry && images ? images[entry[6] ?? 0] : null;
    if (entry && img) {
      const [x, y, w, h, ax, ay] = entry;
      const scale = ch.sprites?.scale ?? 1;
      const k = (size * 0.88) / Math.max(h / scale, (w / scale) * 1.1);
      c.translate(size / 2, size * 0.96);
      if (flip) c.scale(-1, 1);
      c.drawImageRect(img, Skia.XYWHRect(x, y, w, h), Skia.XYWHRect((-ax / scale) * k + (w / scale) * k * 0.0, (-ay / scale) * k, (w / scale) * k, (h / scale) * k), Skia.Paint());
    } else {
      const p = Skia.Paint();
      p.setColor(Skia.Color(ch.style.body));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(size * 0.3, size * 0.25, size * 0.4, size * 0.7), 8, 8), p);
      p.setColor(Skia.Color(ch.style.skin));
      c.drawCircle(size / 2, size * 0.18, size * 0.11, p);
    }
    picture = rec.finishRecordingAsPicture();
  } catch {
    picture = null;
  }

  return (
    <View style={{ width: size, height: size }}>
      {picture ? (
        <Canvas style={{ width: size, height: size }}>
          <Picture picture={picture} />
        </Canvas>
      ) : null}
    </View>
  );
}
