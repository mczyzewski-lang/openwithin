"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck, Heart } from "lucide-react";

export function ExperienceActions({ libraryId, isFavorite, saved }: { libraryId: string; isFavorite: boolean; saved: boolean }) {
  const t = useTranslations("experience");
  const [fav, setFav] = useState(isFavorite);
  const [isSaved, setSaved] = useState(saved);
  const patch = (body: object) => fetch(`/api/library/${libraryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        className="btn-ghost px-4 py-2.5 text-sm"
        aria-pressed={isSaved}
        onClick={() => {
          setSaved(!isSaved);
          void patch({ saved: !isSaved });
        }}
      >
        {isSaved ? <BookmarkCheck className="h-4 w-4 text-champagne" /> : <Bookmark className="h-4 w-4" />} {isSaved ? t("savedInLibrary") : t("saveToLibrary")}
      </button>
      <button
        className="btn-ghost px-4 py-2.5 text-sm"
        aria-pressed={fav}
        onClick={() => {
          setFav(!fav);
          void patch({ isFavorite: !fav });
        }}
      >
        <Heart className={`h-4 w-4 ${fav ? "fill-champagne text-champagne" : ""}`} /> {t("favorite")}
      </button>
    </div>
  );
}
