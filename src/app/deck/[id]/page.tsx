"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from "react";

const DECK_COLUMN_FILTERS_KEY = "pstudy-deck-column-filters";

type DeckColumnFilters = {
  mc: boolean;
  keywords: boolean;
  instruction: boolean;
};

const defaultColumnFilters: DeckColumnFilters = {
  mc: true,
  keywords: true,
  instruction: true,
};

function loadDeckColumnFilters(deckId: string): DeckColumnFilters {
  if (typeof window === "undefined") return defaultColumnFilters;
  try {
    const raw = localStorage.getItem(`${DECK_COLUMN_FILTERS_KEY}:${deckId}`);
    if (!raw) return defaultColumnFilters;
    const p = JSON.parse(raw) as Partial<DeckColumnFilters>;
    return {
      mc: typeof p.mc === "boolean" ? p.mc : true,
      keywords: typeof p.keywords === "boolean" ? p.keywords : true,
      instruction: typeof p.instruction === "boolean" ? p.instruction : true,
    };
  } catch {
    return defaultColumnFilters;
  }
}

function saveDeckColumnFilters(deckId: string, f: DeckColumnFilters) {
  try {
    localStorage.setItem(`${DECK_COLUMN_FILTERS_KEY}:${deckId}`, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}
import Link from "next/link";
import { Deck, PStudyItem } from "@/types/pstudy";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  DECK_CHECKED_READONLY,
  duplicateOwnedDeck,
  fetchDeck,
  isFieldLabelUsedInOwnedDecks,
  isFieldTopicPairUsedInOwnedDecks,
  saveDeckWithItems,
} from "@/lib/supabase/decks";
import { ExpandableField } from "@/components/ExpandableField";
import { PictureUpload } from "@/components/PictureUpload";
import { ConfirmModal } from "@/components/ConfirmModal";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { useToast } from "@/components/Toast";
import { FIELDS_OF_INTEREST, getTopicsForField } from "@/lib/deck-attributes";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import {
  isClassificationValueLengthValid,
  isPresetFieldOfInterest,
  isPresetTopicForField,
  MAX_DECK_CLASSIFICATION_LEN,
} from "@/lib/deck-classification-validate";
import {
  addUserCustomFieldIfNew,
  addUserCustomTopicForFieldIfNew,
  DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD,
  DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC,
  loadUserCustomFields,
  loadUserCustomTopicsMap,
  removeUserCustomFieldFromList,
  removeUserCustomTopicFromList,
} from "@/lib/user-classification-suggestions";
import { writeLastDeckClassificationPrefs } from "@/lib/last-deck-classification-prefs";
import { SpeechLanguageSelectOptions } from "@/components/SpeechLanguageSelectOptions";
import { matchSpeechLanguageSelectValue } from "@/lib/speech-languages";
import {
  deckContentLanguagesClassificationComplete,
  getDeckContentLanguageLabel,
  parseDeckContentLanguages,
  serializeDeckContentLanguages,
  type DeckContentLanguageCode,
} from "@/lib/deck-content-language";
import { deckIsReadOnlyPublication } from "@/lib/deck-publication";
import type { DeckOrgShareVisibility } from "@/types/organization";
import {
  fetchMyOrganizationMemberships,
  listDeckOrgSharesForOrgs,
  removeSchoolDeckShare,
  upsertSchoolDeckShare,
  verifySchoolDeckShare,
  type DeckOrgShareState,
  type OrganizationMembership,
} from "@/lib/supabase/organizations";

function isClassificationComplete(
  d: Pick<Deck, "fieldOfInterest" | "topic" | "contentLanguage">
): boolean {
  return Boolean(
    d.fieldOfInterest?.trim() &&
      d.topic?.trim() &&
      deckContentLanguagesClassificationComplete(d.contentLanguage)
  );
}

export default function DeckEditorPage() {
  const params = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const id = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewInviteOpen, setReviewInviteOpen] = useState(false);
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  const prevItemCountRef = useRef(-1);
  const [columnFilters, setColumnFilters] = useState<DeckColumnFilters>(defaultColumnFilters);
  const skipNextColumnSaveRef = useRef(true);
  const [wantsShare, setWantsShare] = useState(false);
  const wantsShareRef = useRef(false);
  const shareUiInitializedForDeckId = useRef<string | null>(null);
  const [deckSetupOpen, setDeckSetupOpen] = useState(true);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [duplicatingDeck, setDuplicatingDeck] = useState(false);
  const [resubmittingReview, setResubmittingReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [orgMemberships, setOrgMemberships] = useState<OrganizationMembership[]>([]);
  const [allOrgShares, setAllOrgShares] = useState<DeckOrgShareState[]>([]);
  const [schoolOrgId, setSchoolOrgId] = useState<string>("");
  const [schoolShare, setSchoolShare] = useState<DeckOrgShareState | null>(null);
  const [schoolVisibilityChoice, setSchoolVisibilityChoice] = useState<
    DeckOrgShareVisibility | "none"
  >("none");
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [userFieldList, setUserFieldList] = useState<string[]>([]);
  const [userTopicsMap, setUserTopicsMap] = useState<Record<string, string[]>>({});
  const [fieldSelect, setFieldSelect] = useState("");
  const [fieldCustomText, setFieldCustomText] = useState("");
  /** If non-null, Escape in field custom input restores this list value (captured when choosing "type your own"). */
  const [fieldEscapeListSnapshot, setFieldEscapeListSnapshot] = useState<string | null>(null);
  const [topicSelect, setTopicSelect] = useState("");
  const [topicCustomText, setTopicCustomText] = useState("");
  const [topicEscapeListSnapshot, setTopicEscapeListSnapshot] = useState<string | null>(null);
  const fieldCustomInputRef = useRef<HTMLInputElement | null>(null);
  const topicCustomInputRef = useRef<HTMLInputElement | null>(null);
  const [classificationLabelBusy, setClassificationLabelBusy] = useState<string | null>(null);
  const [classificationValidating, setClassificationValidating] = useState(false);
  const lastSyncedClassificationDeckIdRef = useRef<string | null>(null);

  const deckContentLangCodes = useMemo(
    () => parseDeckContentLanguages(deck?.contentLanguage),
    [deck?.contentLanguage]
  );
  const deckFirstContentLang = deckContentLangCodes[0] ?? "";

  const mergedFieldOptions = useMemo(() => {
    const preset = FIELDS_OF_INTEREST as readonly string[];
    const fromUser = userFieldList.filter(
      (x: string) => !(FIELDS_OF_INTEREST as readonly string[]).includes(x)
    );
    fromUser.sort((a: string, b: string) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    );
    return [...preset, ...fromUser];
  }, [userFieldList]);

  const effectiveFieldForTopicList = useMemo((): string | null => {
    if (fieldSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD) {
      const t = fieldCustomText.trim();
      if (t) return t;
      return deck?.fieldOfInterest?.trim() || null;
    }
    return fieldSelect.trim() || null;
  }, [fieldSelect, fieldCustomText, deck?.fieldOfInterest]);

  const mergedTopicOptions = useMemo(() => {
    const base = getTopicsForField(effectiveFieldForTopicList);
    if (!effectiveFieldForTopicList) {
      return base;
    }
    const extra = userTopicsMap[effectiveFieldForTopicList] ?? [];
    const seen = new Set(base);
    const more = extra.filter((x: string) => !seen.has(x));
    more.sort((a: string, b: string) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    );
    return [...base, ...more];
  }, [effectiveFieldForTopicList, userTopicsMap]);

  const userOnlyCustomFields = useMemo(() => {
    const preset = new Set(FIELDS_OF_INTEREST as readonly string[]);
    return userFieldList.filter((f) => !preset.has(f));
  }, [userFieldList]);

  const userOnlyCustomTopicsForEffectiveField = useMemo(() => {
    const fk = effectiveFieldForTopicList;
    if (!fk) return [];
    const preset = new Set(getTopicsForField(fk));
    return (userTopicsMap[fk] ?? []).filter((t) => !preset.has(t));
  }, [effectiveFieldForTopicList, userTopicsMap]);

  const columnFilterSummary = useMemo(() => {
    const n =
      (columnFilters.mc ? 1 : 0) +
      (columnFilters.keywords ? 1 : 0) +
      (columnFilters.instruction ? 1 : 0);
    if (n === 0) return t("deck.columnFiltersSummaryNone");
    if (n === 3) return t("deck.columnFiltersSummaryAll");
    const parts: string[] = [];
    if (columnFilters.mc) parts.push(t("deck.showMcColumn"));
    if (columnFilters.keywords) parts.push(t("deck.showKeywordsColumn"));
    if (columnFilters.instruction) parts.push(t("deck.showInstructionColumn"));
    return parts.join(", ");
  }, [columnFilters, t]);

  useEffect(() => {
    wantsShareRef.current = wantsShare;
  }, [wantsShare]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    function onDocDown(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setColumnMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnMenuOpen]);

  useEffect(() => {
    skipNextColumnSaveRef.current = true;
    setColumnFilters(loadDeckColumnFilters(id));
  }, [id]);

  useEffect(() => {
    if (skipNextColumnSaveRef.current) {
      skipNextColumnSaveRef.current = false;
      return;
    }
    saveDeckColumnFilters(id, columnFilters);
  }, [id, columnFilters]);

  useEffect(() => {
    if (!deck) return;
    if (lastSyncedClassificationDeckIdRef.current === deck.id) return;
    lastSyncedClassificationDeckIdRef.current = deck.id;

    const userF = loadUserCustomFields();
    const map = loadUserCustomTopicsMap();
    setUserFieldList(userF);
    setUserTopicsMap(map);

    const f = deck.fieldOfInterest?.trim() || "";
    const allFieldSet = new Set<string>([
      ...FIELDS_OF_INTEREST,
      ...userF,
    ]);
    if (!f) {
      setFieldSelect("");
      setFieldCustomText("");
    } else if (allFieldSet.has(f)) {
      setFieldSelect(f);
      setFieldCustomText("");
    } else {
      setFieldSelect(DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD);
      setFieldCustomText(f);
    }

    const fieldKey = f;
    const baseTopics = getTopicsForField(fieldKey || null);
    const extraT = fieldKey ? map[fieldKey] ?? [] : [];
    const allTopicSet = new Set<string>([...baseTopics, ...extraT]);
    const top = deck.topic?.trim() || "";
    if (!top) {
      setTopicSelect("");
      setTopicCustomText("");
    } else if (allTopicSet.has(top)) {
      setTopicSelect(top);
      setTopicCustomText("");
    } else {
      setTopicSelect(DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC);
      setTopicCustomText(top);
    }

    setFieldEscapeListSnapshot(null);
    setTopicEscapeListSnapshot(null);
  }, [deck]);

  useEffect(() => {
    if (!deck) return;
    if (prevItemCountRef.current === -1) {
      prevItemCountRef.current = deck.items.length;
      return;
    }
    if (deck.items.length > prevItemCountRef.current) {
      lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevItemCountRef.current = deck.items.length;
  }, [deck?.items.length]);

  useEffect(() => {
    if (!reviewInviteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewInviteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewInviteOpen]);

  useLayoutEffect(() => {
    if (fieldSelect !== DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD) return;
    if (fieldEscapeListSnapshot === null) return;
    fieldCustomInputRef.current?.focus();
  }, [fieldSelect, fieldEscapeListSnapshot]);

  useLayoutEffect(() => {
    if (topicSelect !== DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC) return;
    if (topicEscapeListSnapshot === null) return;
    topicCustomInputRef.current?.focus();
  }, [topicSelect, topicEscapeListSnapshot]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(user.id);
      const d = await fetchDeck(id);
      setDeck(d ?? null);
      if (d) setTitle(d.title);
      setLoading(false);
    }
    load();
  }, [id, router]);

  useEffect(() => {
    if (!deck?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const mems = await fetchMyOrganizationMemberships();
        if (cancelled) return;
        setOrgMemberships(mems);
        if (mems.length === 0) {
          setAllOrgShares([]);
          setSchoolShare(null);
          setSchoolOrgId("");
          return;
        }
        const ids = mems.map((m) => m.organizationId);
        const shares = await listDeckOrgSharesForOrgs(deck.id, ids);
        if (cancelled) return;
        setAllOrgShares(shares);
        const pickOrg = shares[0]?.organizationId ?? mems[0]!.organizationId;
        setSchoolOrgId(pickOrg);
        const cur = shares.find((s) => s.organizationId === pickOrg) ?? null;
        setSchoolShare(cur);
        setSchoolVisibilityChoice(cur?.visibility ?? "none");
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck?.id]);

  useEffect(() => {
    if (!deck) return;
    if (shareUiInitializedForDeckId.current !== deck.id) {
      shareUiInitializedForDeckId.current = deck.id;
      const pub = deck.isPublic ?? false;
      setWantsShare(pub);
      wantsShareRef.current = pub;
    }
  }, [deck]);

  const persistDeck = useCallback(
    async (updated: Deck) => {
      if (!updated) return;
        if (
          updated.publicationStatus === "checked" ||
          updated.publicationStatus === "superseded"
        )
          return;
      setSaving(true);
      try {
        await saveDeckWithItems(updated);
      } catch (err) {
        if (err instanceof Error && err.message === DECK_CHECKED_READONLY) {
          toast.error(t("deck.checkedCannotSave"));
        } else {
          toast.error(err instanceof Error ? err.message : t("common.failedToSave"));
        }
      } finally {
        setSaving(false);
      }
    },
    [toast, t]
  );

  function updateDeckLocal(updates: Partial<Deck>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const merged = {
      ...deck,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (updates.items !== undefined) {
      merged.itemCount = updates.items.length;
    }
    const next: Deck = {
      ...merged,
      isPublic: Boolean(wantsShareRef.current && isClassificationComplete(merged)),
    };
    if (
      "fieldOfInterest" in updates ||
      "topic" in updates ||
      "contentLanguage" in updates
    ) {
      writeLastDeckClassificationPrefs({
        fieldOfInterest: next.fieldOfInterest ?? null,
        topic: next.topic ?? null,
        contentLanguage: next.contentLanguage ?? null,
      });
    }
    setDeck(next);
    void persistDeck(next);
  }

  function applyFieldListSelection(v: string) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setFieldSelect(v);
    setFieldCustomText("");
    setFieldEscapeListSnapshot(null);
    updateDeckLocal({ fieldOfInterest: v || null, topic: null });
    setTopicSelect("");
    setTopicCustomText("");
    setTopicEscapeListSnapshot(null);
  }

  function applyTopicListSelection(v: string) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setTopicSelect(v);
    setTopicCustomText("");
    setTopicEscapeListSnapshot(null);
    updateDeckLocal({ topic: v || null });
  }

  async function handleRemoveUserCustomField(fieldName: string) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const busyId = `field:${fieldName}`;
    setClassificationLabelBusy(busyId);
    try {
      const inUse = await isFieldLabelUsedInOwnedDecks(fieldName);
      if (inUse) {
        toast.error(t("deck.classificationRemoveInUseField"));
        return;
      }
      removeUserCustomFieldFromList(fieldName);
      setUserFieldList(loadUserCustomFields());
      setUserTopicsMap(loadUserCustomTopicsMap());
      revertClassificationUiFromDeck();
      toast.success(t("deck.classificationRemovedFromList"));
    } catch {
      toast.error(t("common.failedToLoadDecks"));
    } finally {
      setClassificationLabelBusy(null);
    }
  }

  async function handleRemoveUserCustomTopic(fieldKey: string, topic: string) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const busyId = `topic:${fieldKey}::${topic}`;
    setClassificationLabelBusy(busyId);
    try {
      const inUse = await isFieldTopicPairUsedInOwnedDecks(fieldKey, topic);
      if (inUse) {
        toast.error(t("deck.classificationRemoveInUseTopic"));
        return;
      }
      removeUserCustomTopicFromList(fieldKey, topic);
      setUserFieldList(loadUserCustomFields());
      setUserTopicsMap(loadUserCustomTopicsMap());
      revertClassificationUiFromDeck();
      toast.success(t("deck.classificationRemovedFromList"));
    } catch {
      toast.error(t("common.failedToLoadDecks"));
    } finally {
      setClassificationLabelBusy(null);
    }
  }

  function revertClassificationUiFromDeck() {
    if (!deck) return;
    const userF = loadUserCustomFields();
    const map = loadUserCustomTopicsMap();
    const f = deck.fieldOfInterest?.trim() || "";
    const allFieldSet = new Set<string>([...FIELDS_OF_INTEREST, ...userF]);
    if (!f) {
      setFieldSelect("");
      setFieldCustomText("");
    } else if (allFieldSet.has(f)) {
      setFieldSelect(f);
      setFieldCustomText("");
    } else {
      setFieldSelect(DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD);
      setFieldCustomText(f);
    }
    const fieldKey = f;
    const baseTopics = getTopicsForField(fieldKey || null);
    const extraT = fieldKey ? map[fieldKey] ?? [] : [];
    const allTopicSet = new Set<string>([...baseTopics, ...extraT]);
    const top = deck.topic?.trim() || "";
    if (!top) {
      setTopicSelect("");
      setTopicCustomText("");
    } else if (allTopicSet.has(top)) {
      setTopicSelect(top);
      setTopicCustomText("");
    } else {
      setTopicSelect(DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC);
      setTopicCustomText(top);
    }
    setFieldEscapeListSnapshot(null);
    setTopicEscapeListSnapshot(null);
  }

  function needsModerationForValues(
    nextF: string | null,
    nextT: string | null,
    userFields: string[],
    topicsByField: Record<string, string[]>
  ): boolean {
    if (nextF) {
      const presetF = isPresetFieldOfInterest(nextF);
      const knownF = presetF || userFields.some((x) => x === nextF);
      if (!knownF) return true;
    }
    if (nextT && nextF) {
      const presetT = isPresetTopicForField(nextF, nextT);
      const knownT = presetT || (topicsByField[nextF] ?? []).includes(nextT);
      if (!knownT) return true;
    }
    return false;
  }

  async function validateAndSaveClassification(nextF: string | null, nextT: string | null) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const curF = deck.fieldOfInterest?.trim() || null;
    const curT = deck.topic?.trim() || null;
    if (curF === nextF && curT === nextT) return;
    const rawF = nextF ?? "";
    const rawT = nextT ?? "";
    if (!isClassificationValueLengthValid(rawF) || !isClassificationValueLengthValid(rawT)) {
      toast.error(
        t("deck.classificationTooLong", { max: String(MAX_DECK_CLASSIFICATION_LEN) })
      );
      revertClassificationUiFromDeck();
      return;
    }

    const userFields = loadUserCustomFields();
    const topicsByField = loadUserCustomTopicsMap();
    const needMod = needsModerationForValues(nextF, nextT, userFields, topicsByField);

    setClassificationValidating(true);
    try {
      if (needMod) {
        const res = await fetch("/api/deck/validate-classification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fieldOfInterest: nextF, topic: nextT }),
        });
        if (res.status === 401) {
          toast.error(t("deck.classificationSessionRequired"));
          revertClassificationUiFromDeck();
          return;
        }
        if (res.status === 422) {
          toast.error(t("deck.classificationModerationFailed"));
          revertClassificationUiFromDeck();
          return;
        }
        if (res.status === 503) {
          toast.toast(t("deck.classificationModerationSkippedSave"), "info");
        } else if (!res.ok) {
          toast.error(t("deck.classificationModerationUnavailable"));
          revertClassificationUiFromDeck();
          return;
        }
      }
      updateDeckLocal({ fieldOfInterest: nextF, topic: nextT });
      if (nextF && !isPresetFieldOfInterest(nextF)) {
        addUserCustomFieldIfNew(nextF);
      }
      if (nextF && nextT && !isPresetTopicForField(nextF, nextT)) {
        addUserCustomTopicForFieldIfNew(nextF, nextT);
      }
      setUserFieldList(loadUserCustomFields());
      setUserTopicsMap(loadUserCustomTopicsMap());
      {
        const U = loadUserCustomFields();
        if (nextF) {
          const allF = new Set<string>([...FIELDS_OF_INTEREST, ...U]);
          if (allF.has(nextF)) {
            setFieldSelect(nextF);
            setFieldCustomText("");
          } else {
            setFieldSelect(DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD);
            setFieldCustomText(nextF);
          }
        }
        if (nextF && nextT) {
          const mapT = loadUserCustomTopicsMap();
          const allT = new Set<string>([
            ...getTopicsForField(nextF),
            ...(mapT[nextF] ?? []),
          ]);
          if (allT.has(nextT)) {
            setTopicSelect(nextT);
            setTopicCustomText("");
          }
        }
      }
      setFieldEscapeListSnapshot(null);
      setTopicEscapeListSnapshot(null);
    } catch {
      toast.error(t("common.failedToSave"));
      revertClassificationUiFromDeck();
    } finally {
      setClassificationValidating(false);
    }
  }

  function onFieldSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const v = e.target.value;
    if (v === DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD) {
      setFieldEscapeListSnapshot(fieldSelect);
      setFieldSelect(v);
      setFieldCustomText(deck.fieldOfInterest?.trim() ?? "");
      return;
    }
    applyFieldListSelection(v);
  }

  function onTopicSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const v = e.target.value;
    if (v === DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC) {
      setTopicEscapeListSnapshot(topicSelect);
      setTopicSelect(v);
      setTopicCustomText(deck.topic?.trim() ?? "");
      return;
    }
    applyTopicListSelection(v);
  }

  function resolveNextTopicForClassificationSave(): string | null {
    if (topicSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC) {
      const el = document.getElementById("deck-topic-custom") as HTMLInputElement | null;
      return ((el?.value ?? topicCustomText) as string).trim() || null;
    }
    const t = topicSelect.trim();
    if (t) return t;
    return deck?.topic?.trim() || null;
  }

  function onFieldCustomBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    if (fieldSelect !== DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD) return;
    const nextF = e.currentTarget.value.trim() || null;
    const nextT = resolveNextTopicForClassificationSave();
    void validateAndSaveClassification(nextF, nextT);
  }

  function onTopicCustomBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    if (topicSelect !== DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC) return;
    let nextF: string | null = null;
    if (fieldSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD) {
      const el = document.getElementById("deck-field-custom") as HTMLInputElement | null;
      nextF = (el?.value ?? fieldCustomText).trim() || null;
    } else {
      nextF = fieldSelect.trim() || null;
    }
    const nextT = e.currentTarget.value.trim() || null;
    void validateAndSaveClassification(nextF, nextT);
  }

  function onFieldCustomKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    if (fieldEscapeListSnapshot !== null) {
      applyFieldListSelection(fieldEscapeListSnapshot);
    } else {
      setFieldCustomText(deck.fieldOfInterest?.trim() ?? "");
    }
  }

  function onTopicCustomKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    if (topicEscapeListSnapshot !== null) {
      applyTopicListSelection(topicEscapeListSnapshot);
    } else {
      setTopicCustomText(deck.topic?.trim() ?? "");
    }
  }

  function handleShareToggle(checked: boolean) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setWantsShare(checked);
    wantsShareRef.current = checked;
    const merged = {
      ...deck,
      updatedAt: new Date().toISOString(),
    };
    const next: Deck = {
      ...merged,
      isPublic: Boolean(checked && isClassificationComplete(merged)),
    };
    setDeck(next);
    void persistDeck(next);
    if (checked && !isClassificationComplete(merged)) {
      toast.toast(t("deck.shareFillClassification"));
    }
  }

  function updateTitleLocal(newTitle: string) {
    if (deck && deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setTitle(newTitle);
    if (!deck) return;
    updateDeckLocal({ title: newTitle });
  }

  function updateItem(index: number, item: PStudyItem) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const items = [...deck.items];
    items[index] = item;
    updateDeckLocal({ items });
  }

  function addItem() {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const newItem: PStudyItem = {
      id: crypto.randomUUID(),
      description: "",
      explanation: "",
      multiplechoice1: "",
      multiplechoice2: "",
      multiplechoice3: "",
      multiplechoice4: "",
      picture_url: "",
      instruction: "",
      keywords: "",
    };
    updateDeckLocal({ items: [...deck.items, newItem] });
  }

  function removeItem(index: number) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setRemoveItemIndex(index);
  }

  function confirmRemoveItem() {
    if (!deck || removeItemIndex === null || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft"))
      return;
    const items = deck.items.filter((_, i) => i !== removeItemIndex);
    updateDeckLocal({ items });
    setRemoveItemIndex(null);
  }

  function fillInstructionForAll(instructionText: string) {
    if (!deck || deck.items.length === 0 || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft"))
      return;
    const v = instructionText.trim();
    const items = deck.items.map((item) => ({
      ...item,
      instruction: v,
    }));
    updateDeckLocal({ items });
  }

  async function sendReviewInvite() {
    if (!deck?.isPublic || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const email = reviewEmail.trim();
    if (!email) {
      toast.error(t("deckReview.emailRequired"));
      return;
    }
    setReviewSending(true);
    try {
      const res = await fetch("/api/deck-review/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deckId: id, reviewerEmail: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "invite failed");
      toast.success(
        data.emailed ? t("deckReview.inviteSent") : t("deckReview.inviteCreatedNoEmail")
      );
      setReviewEmail("");
      setReviewInviteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("deckReview.inviteFailed"));
    } finally {
      setReviewSending(false);
    }
  }

  async function handleResubmitForReview() {
    if (!deck?.id || resubmittingReview) return;
    setResubmittingReview(true);
    try {
      const res = await fetch("/api/deck-review/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "resubmit failed");
      setDeck((d) =>
        d ? { ...d, reviewStatus: "resubmitted" as const } : d
      );
      toast.success(t("deckReview.resubmitSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setResubmittingReview(false);
    }
  }

  async function handleDuplicateForEdit() {
    if (!deck || duplicatingDeck) return;
    setDuplicatingDeck(true);
    try {
      const d = await duplicateOwnedDeck(deck.id, {
        publicNextRevision: (deck.publicationStatus === "checked" || deck.publicationStatus === "verified") && !!deck.isPublic,
      });
      router.push(`/deck/${d.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setDuplicatingDeck(false);
    }
  }

  function onSelectSchoolOrg(oid: string) {
    setSchoolOrgId(oid);
    const cur = allOrgShares.find((s) => s.organizationId === oid) ?? null;
    setSchoolShare(cur);
    setSchoolVisibilityChoice(cur?.visibility ?? "none");
  }

  async function handleSaveSchoolShare() {
    if (!deck || !schoolOrgId) return;
    const mem = orgMemberships.find((m) => m.organizationId === schoolOrgId);
    if (!mem) return;

    if (schoolVisibilityChoice === "none") {
      if (!schoolShare) return;
      setSchoolBusy(true);
      try {
        await removeSchoolDeckShare(deck.id, schoolOrgId);
        const shares = await listDeckOrgSharesForOrgs(
          deck.id,
          orgMemberships.map((m) => m.organizationId)
        );
        setAllOrgShares(shares);
        const cur = shares.find((s) => s.organizationId === schoolOrgId) ?? null;
        setSchoolShare(cur ?? null);
        setSchoolVisibilityChoice("none");
        toast.success(t("school.shareRemoved"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("school.shareFailed"));
      } finally {
        setSchoolBusy(false);
      }
      return;
    }

    if (schoolVisibilityChoice === "teachers_only" && mem.role === "student") {
      toast.error(t("school.roleRequiredTeachersOnly"));
      return;
    }
    setSchoolBusy(true);
    try {
      await upsertSchoolDeckShare(deck.id, schoolOrgId, schoolVisibilityChoice);
      const shares = await listDeckOrgSharesForOrgs(
        deck.id,
        orgMemberships.map((m) => m.organizationId)
      );
      setAllOrgShares(shares);
      const cur = shares.find((s) => s.organizationId === schoolOrgId) ?? null;
      setSchoolShare(cur);
      toast.success(t("school.shareSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("school.shareFailed"));
    } finally {
      setSchoolBusy(false);
    }
  }

  async function handleRemoveSchoolShare() {
    if (!deck || !schoolShare) return;
    setSchoolBusy(true);
    try {
      await removeSchoolDeckShare(deck.id, schoolShare.organizationId);
      const shares = await listDeckOrgSharesForOrgs(
        deck.id,
        orgMemberships.map((m) => m.organizationId)
      );
      setAllOrgShares(shares);
      const cur = shares.find((s) => s.organizationId === schoolOrgId) ?? null;
      setSchoolShare(cur ?? null);
      setSchoolVisibilityChoice("none");
      toast.success(t("school.shareRemoved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("school.shareFailed"));
    } finally {
      setSchoolBusy(false);
    }
  }

  async function handleVerifySchoolFromDeck() {
    if (!deck || !schoolShare || schoolShare.visibility !== "school") return;
    setSchoolBusy(true);
    try {
      await verifySchoolDeckShare(deck.id, schoolShare.organizationId);
      const shares = await listDeckOrgSharesForOrgs(
        deck.id,
        orgMemberships.map((m) => m.organizationId)
      );
      setAllOrgShares(shares);
      const cur = shares.find((s) => s.organizationId === schoolOrgId) ?? null;
      setSchoolShare(cur ?? null);
      toast.success(t("school.verifySuccess"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(t("school.alreadyVerified"));
      } else {
        toast.error(e instanceof Error ? e.message : t("school.verifyFailed"));
      }
    } finally {
      setSchoolBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-stone-600">{t("common.loading")}</p>
        <HelpNavLink />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <p className="text-stone-600">{t("practice.deckNotFound")}</p>
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            {t("result.backToDashboard")}
          </Link>
        </div>
        <HelpNavLink />
      </div>
    );
  }

  const deckLocked = deck ? deckIsReadOnlyPublication(deck.publicationStatus ?? "draft") : false;
  const isDeckOwner = !!(deck && currentUserId && deck.ownerId === currentUserId);

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        maxWidthClassName="max-w-5xl"
        nav={
          <>
            <AppHeaderLink href="/account">{t("dashboard.navAccount")}</AppHeaderLink>
            <AppHeaderLink href="/dashboard">{t("dashboard.myDecks")}</AppHeaderLink>
            <AppHeaderLink href="/school">{t("dashboard.school")}</AppHeaderLink>
            <AppHeaderLink href="/community">{t("dashboard.community")}</AppHeaderLink>
            <AppHeaderLink href="/import">{t("import.navLink")}</AppHeaderLink>
            <HelpNavLink />
          </>
        }
      >
        <div className="space-y-3 border-t border-stone-100 pt-3">
            <input
              type="text"
              value={title}
              readOnly={deckLocked}
              onChange={(e) => updateTitleLocal(e.target.value)}
              title={deckLocked ? t("deck.checkedCannotEditTitle") : undefined}
              className={`w-full max-w-3xl rounded border px-3 py-1.5 text-base font-semibold focus:outline-none focus:ring-1 sm:text-lg ${
                deckLocked
                  ? "cursor-default border-stone-200 bg-stone-50 text-stone-800"
                  : "border-stone-300 text-stone-900 focus:border-pstudy-primary focus:ring-pstudy-primary"
              }`}
            />
            {deckLocked ? (
              <div className="w-full max-w-3xl rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 text-sm text-stone-800">
                <p className="font-medium text-emerald-900">{t("deck.communitySharingSection")}</p>
                <p className="mt-1 text-stone-700">{t("deck.checkedCommunitySectionHint")}</p>
                <dl className="mt-3 grid gap-1 text-stone-700 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                  <dt className="text-stone-500">{t("deck.field")}</dt>
                  <dd>{deck.fieldOfInterest ?? "—"}</dd>
                  <dt className="text-stone-500">{t("deck.topic")}</dt>
                  <dd>{deck.topic ?? "—"}</dd>
                  <dt className="text-stone-500">{t("deck.contentLanguage")}</dt>
                  <dd>
                    {deckContentLangCodes.length > 0
                      ? deckContentLangCodes
                          .map((code) => getDeckContentLanguageLabel(code, t))
                          .join(`${t("deck.contentLanguagePairSeparator")}`)
                      : "—"}
                  </dd>
                </dl>
              </div>
            ) : (
              <details
                className="w-full max-w-3xl rounded border border-stone-200 bg-white px-3 py-2"
                open={deckSetupOpen}
                onToggle={(e) => setDeckSetupOpen(e.currentTarget.open)}
              >
                <summary className="cursor-pointer select-none text-sm font-medium text-stone-700 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2">
                  {t("deck.deckSetup")}
                </summary>
                <div className="mt-3 space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-0 flex-1 sm:min-w-[10rem] sm:max-w-[16rem]">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <label
                          className="m-0 text-sm text-stone-600"
                          htmlFor={
                            fieldSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD
                              ? "deck-field-custom"
                              : "deck-field-select"
                          }
                        >
                          {t("community.fieldOfInterest")}
                        </label>
                        <ContextHint>
                          <p className="m-0 text-sm text-stone-700">
                            {t("deck.classificationFreeTextHint")}
                          </p>
                        </ContextHint>
                      </div>
                      {fieldSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD ? (
                        <input
                          ref={fieldCustomInputRef}
                          id="deck-field-custom"
                          type="text"
                          value={fieldCustomText}
                          onChange={(e) => setFieldCustomText(e.target.value)}
                          onBlur={onFieldCustomBlur}
                          onKeyDown={onFieldCustomKeyDown}
                          maxLength={MAX_DECK_CLASSIFICATION_LEN}
                          autoComplete="off"
                          placeholder={t("deck.classificationCustomFieldPlaceholder")}
                          disabled={saving || classificationValidating}
                          aria-invalid={!deck?.fieldOfInterest?.trim()}
                          className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:opacity-60"
                        />
                      ) : (
                        <select
                          id="deck-field-select"
                          value={fieldSelect}
                          onChange={onFieldSelectChange}
                          disabled={saving || classificationValidating}
                          aria-invalid={!deck?.fieldOfInterest?.trim()}
                          className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:opacity-60"
                        >
                          <option value="">—</option>
                          {mergedFieldOptions.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                          <option value={DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD}>
                            {t("deck.classificationTypeOwnField")}
                          </option>
                        </select>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 sm:min-w-[10rem] sm:max-w-[16rem]">
                      <label
                        className="mb-1 block text-sm text-stone-600"
                        htmlFor={
                          topicSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC
                            ? "deck-topic-custom"
                            : "deck-topic-select"
                        }
                      >
                        {t("community.topic")}
                      </label>
                      {topicSelect === DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC ? (
                        <input
                          ref={topicCustomInputRef}
                          id="deck-topic-custom"
                          type="text"
                          value={topicCustomText}
                          onChange={(e) => setTopicCustomText(e.target.value)}
                          onBlur={onTopicCustomBlur}
                          onKeyDown={onTopicCustomKeyDown}
                          maxLength={MAX_DECK_CLASSIFICATION_LEN}
                          autoComplete="off"
                          placeholder={t("deck.classificationCustomTopicPlaceholder")}
                          disabled={saving || classificationValidating}
                          aria-invalid={!deck?.topic?.trim()}
                          className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:opacity-60"
                        />
                      ) : (
                        <select
                          id="deck-topic-select"
                          value={topicSelect}
                          onChange={onTopicSelectChange}
                          disabled={saving || classificationValidating}
                          aria-invalid={!deck?.topic?.trim()}
                          className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:opacity-60"
                        >
                          <option value="">—</option>
                          {mergedTopicOptions.map((top) => (
                            <option key={top} value={top}>
                              {top}
                            </option>
                          ))}
                          <option value={DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC}>
                            {t("deck.classificationTypeOwnTopic")}
                          </option>
                        </select>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-[20rem]">
                      <label
                        className="mb-1 block text-sm text-stone-600"
                        htmlFor="deck-content-lang-1"
                      >
                        {t("deck.contentLanguage")}
                      </label>
                      <select
                        id="deck-content-lang-1"
                        data-testid="deck-language-select"
                        value={matchSpeechLanguageSelectValue(deckFirstContentLang)}
                        title={t("deck.contentLanguageHint")}
                        aria-label={t("deck.contentLanguage")}
                        aria-invalid={!deckContentLanguagesClassificationComplete(deck?.contentLanguage ?? null)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = raw === "" ? null : (raw as DeckContentLanguageCode);
                          updateDeckLocal({
                            contentLanguage: serializeDeckContentLanguages([next]),
                          });
                        }}
                        className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                      >
                        <SpeechLanguageSelectOptions
                          includeEmpty
                          includeOther
                          otherLabel={getDeckContentLanguageLabel("other", t)}
                        />
                      </select>
                    </div>
                </div>
                {classificationValidating ? (
                  <p className="mb-2 text-xs text-stone-600" role="status">
                    {t("deck.classificationChecking")}
                  </p>
                ) : null}

                {userOnlyCustomFields.length > 0 ||
                (effectiveFieldForTopicList && userOnlyCustomTopicsForEffectiveField.length > 0) ? (
                  <div
                    className="rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2.5"
                    data-testid="deck-classification-user-labels"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-stone-600">
                        {t("deck.classificationUserListTitle")}
                      </span>
                      <ContextHint>
                        <p className="m-0 text-sm text-stone-700">
                          {t("deck.classificationUserListHint")}
                        </p>
                      </ContextHint>
                    </div>
                    {userOnlyCustomFields.length > 0 ? (
                      <div className="mb-2">
                        <p className="mb-1 text-xs text-stone-500">
                          {t("community.fieldOfInterest")}
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {userOnlyCustomFields.map((f) => {
                            const busy = classificationLabelBusy === `field:${f}`;
                            return (
                              <li
                                key={`uf:${f}`}
                                className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-800"
                              >
                                <span className="min-w-0 truncate" title={f}>
                                  {f}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveUserCustomField(f)}
                                  disabled={saving || classificationValidating || busy}
                                  className="shrink-0 rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
                                  title={t("deck.classificationRemoveFieldA11y", { label: f })}
                                  aria-label={t("deck.classificationRemoveFieldA11y", { label: f })}
                                >
                                  {busy ? (
                                    <span
                                      className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-stone-300"
                                      aria-hidden
                                    />
                                  ) : (
                                    <span className="text-base leading-none" aria-hidden>
                                      ×
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {effectiveFieldForTopicList && userOnlyCustomTopicsForEffectiveField.length > 0 ? (
                      <div>
                        <p className="mb-1 text-xs text-stone-500">
                          {t("community.topic")} ({effectiveFieldForTopicList})
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {userOnlyCustomTopicsForEffectiveField.map((top) => {
                            const busy =
                              classificationLabelBusy ===
                              `topic:${effectiveFieldForTopicList}::${top}`;
                            return (
                              <li
                                key={`ut:${effectiveFieldForTopicList}:${top}`}
                                className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-800"
                              >
                                <span className="min-w-0 truncate" title={top}>
                                  {top}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRemoveUserCustomTopic(
                                      effectiveFieldForTopicList,
                                      top
                                    )
                                  }
                                  disabled={saving || classificationValidating || busy}
                                  className="shrink-0 rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
                                  title={t("deck.classificationRemoveTopicA11y", {
                                    field: effectiveFieldForTopicList,
                                    topic: top,
                                  })}
                                  aria-label={t("deck.classificationRemoveTopicA11y", {
                                    field: effectiveFieldForTopicList,
                                    topic: top,
                                  })}
                                >
                                  {busy ? (
                                    <span
                                      className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-stone-300"
                                      aria-hidden
                                    />
                                  ) : (
                                    <span className="text-base leading-none" aria-hidden>
                                      ×
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {t("deck.sharingOptionsLabel")}
                    </p>
                    <ContextHint>
                      <div className="space-y-2">
                        <p className="m-0 text-sm text-stone-700">
                          {t("deck.sharingOptionsHint")}
                        </p>
                        {orgMemberships.length === 0 ? (
                          <p className="m-0 text-sm text-stone-700">
                            {t("deck.myCommunitiesRequiresOrgHint")}
                          </p>
                        ) : null}
                      </div>
                    </ContextHint>
                  </div>

                  {orgMemberships.length > 1 ? (
                    <div className="mb-3">
                      <label className="mb-1 block text-stone-600" htmlFor="school-org-select">
                        {t("school.orgLabel")}
                      </label>
                      <select
                        id="school-org-select"
                        value={schoolOrgId}
                        onChange={(e) => onSelectSchoolOrg(e.target.value)}
                        className="w-full max-w-md rounded border border-stone-300 px-2 py-1.5 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                      >
                        {orgMemberships.map((m) => (
                          <option key={m.organizationId} value={m.organizationId}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {schoolOrgId && orgMemberships.length > 0 ? (
                    <p className="mb-2 text-xs text-stone-500">
                      {t("school.yourRole", {
                        role:
                          orgMemberships.find((m) => m.organizationId === schoolOrgId)?.role ?? "—",
                      })}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4 md:gap-x-5">
                    {isDeckOwner && orgMemberships.length > 0 && schoolOrgId ? (
                      <div
                        className="inline-flex min-w-0 flex-wrap items-center gap-3 sm:gap-4 sm:border-r sm:border-stone-200 sm:pr-4 md:pr-5"
                        role="group"
                        aria-label={t("school.shareVisibility")}
                      >
                        <label
                          className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-stone-700"
                          title={t("school.visibilityNoneHint")}
                        >
                          <input
                            type="radio"
                            name="school-vis"
                            checked={schoolVisibilityChoice === "none"}
                            onChange={() => setSchoolVisibilityChoice("none")}
                            className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                          />
                          {t("school.visibilityNone")}
                        </label>
                        <label
                          className={`inline-flex items-center gap-1.5 text-sm ${
                            orgMemberships.find((m) => m.organizationId === schoolOrgId)?.role ===
                            "student"
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer text-stone-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="school-vis"
                            checked={schoolVisibilityChoice === "teachers_only"}
                            disabled={
                              orgMemberships.find((m) => m.organizationId === schoolOrgId)?.role ===
                              "student"
                            }
                            onChange={() => setSchoolVisibilityChoice("teachers_only")}
                            title={t("school.roleRequiredTeachersOnly")}
                            className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary disabled:opacity-50"
                          />
                          {t("school.visibilityTeachersOnly")}
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-stone-700">
                          <input
                            type="radio"
                            name="school-vis"
                            checked={schoolVisibilityChoice === "school"}
                            onChange={() => setSchoolVisibilityChoice("school")}
                            className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                          />
                          <span title={t("school.visibilitySchool")}>
                            {t("school.visibilityMyCommunitiesShort")}
                          </span>
                        </label>
                      </div>
                    ) : orgMemberships.length > 0 && !isDeckOwner ? (
                      <p className="m-0 max-w-sm text-sm text-stone-600 sm:border-r sm:border-stone-200 sm:pr-4">
                        {t("school.ownerReadOnly")}
                      </p>
                    ) : null}

                    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                        <input
                          type="checkbox"
                          checked={wantsShare}
                          onChange={(e) => handleShareToggle(e.target.checked)}
                          className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                        />
                        {t("deck.pstudyCommunityLabel")}
                      </label>
                      {deck?.isPublic && deck.publicationStatus === "verified" ? (
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-900">
                          {t("deckReview.badgeVerified")}
                        </span>
                      ) : deck?.isPublic && deck.publicationStatus === "checked" ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                          {t("deckReview.badgeChecked")}
                        </span>
                      ) : null}
                      {deck?.isPublic && deck.publicationStatus === "draft" ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                          {t("deckReview.badgeDraft")}
                        </span>
                      ) : null}
                      <span
                        className={`inline-block min-w-[5rem] text-sm text-stone-500 ${saving ? "" : "invisible"}`}
                        aria-hidden={!saving}
                      >
                        {t("deck.saving")}
                      </span>
                    </div>
                  </div>
                  {wantsShare && !isClassificationComplete(deck) ? (
                    <p className="mt-2 text-sm text-amber-800">{t("deck.shareIncompleteHint")}</p>
                  ) : null}
                  {deck?.isPublic && deck.publicationStatus === "draft" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewInviteOpen(true)}
                        className="btn-secondary text-sm"
                      >
                        {t("deckReview.peerReview")}
                      </button>
                      {deck.reviewStatus === "revise_and_resubmit" && !deckLocked ? (
                        <button
                          type="button"
                          disabled={resubmittingReview}
                          onClick={() => void handleResubmitForReview()}
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          {resubmittingReview ? t("common.loading") : t("deckReview.resubmitForReview")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {isDeckOwner && orgMemberships.length > 0 && schoolOrgId ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                      <button
                        type="button"
                        disabled={
                          schoolBusy ||
                          !schoolOrgId ||
                          (schoolVisibilityChoice === "none" && !schoolShare)
                        }
                        title={
                          schoolVisibilityChoice === "none" && !schoolShare
                            ? t("school.saveShareNothingToUpdate")
                            : undefined
                        }
                        onClick={() => void handleSaveSchoolShare()}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        {schoolBusy ? t("deck.saving") : t("school.saveShare")}
                      </button>
                      {schoolShare ? (
                        <button
                          type="button"
                          disabled={schoolBusy}
                          onClick={() => void handleRemoveSchoolShare()}
                          className="btn-secondary text-sm disabled:opacity-50"
                        >
                          {t("school.removeShare")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {orgMemberships.length > 0 && schoolShare ? (
                    <div className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-stone-700">
                      {schoolShare.visibility === "school" && !schoolShare.verifiedAt ? (
                        <p className="m-0">{t("school.studentsNeedVerification")}</p>
                      ) : null}
                      {schoolShare.visibility === "school" && schoolShare.verifiedAt ? (
                        <p className="m-0 font-medium text-emerald-800">{t("school.verifiedBadge")}</p>
                      ) : null}
                      {schoolShare.visibility === "teachers_only" ? (
                        <p className="m-0">{t("school.visibilityTeachersOnly")}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {schoolShare?.visibility === "school" &&
                  !schoolShare.verifiedAt &&
                  schoolOrgId &&
                  (orgMemberships.find((m) => m.organizationId === schoolOrgId)?.role === "teacher" ||
                    orgMemberships.find((m) => m.organizationId === schoolOrgId)?.role === "admin") ? (
                    <button
                      type="button"
                      disabled={schoolBusy}
                      onClick={() => void handleVerifySchoolFromDeck()}
                      className="btn-secondary mt-3 text-sm disabled:opacity-50"
                    >
                      {t("school.verifyDeck")}
                    </button>
                  ) : null}
                </div>
                </div>
              </details>
            )}
        </div>
      </AppHeader>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {deckLocked ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-stone-800">
            <p className="font-semibold text-emerald-950">{t("deck.checkedReadOnlyTitle")}</p>
            <p className="mt-1 text-stone-700">{t("deck.checkedReadOnlyBody")}</p>
            <button
              type="button"
              className="btn-primary mt-3 text-sm disabled:opacity-50"
              disabled={duplicatingDeck}
              onClick={() => void handleDuplicateForEdit()}
            >
              {duplicatingDeck ? t("community.copying") : t("deck.duplicateToEdit")}
            </button>
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <span className="text-stone-600">{deck.items.length} {t("dashboard.items", { count: deck.items.length })}</span>
          {!deckLocked ? (
          <button type="button" onClick={addItem} className="btn-primary text-sm">
            {t("deck.addItem")}
          </button>
          ) : null}
          <Link href={`/exams/new?deck=${id}`} className="btn-secondary text-sm">
            {t("exam.newExam")}
          </Link>
          <Link href={`/practice/${id}`} className="btn-primary text-sm">
            {t("common.practice")}
          </Link>
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              data-testid="deck-column-filters-trigger"
              aria-label={t("deck.columnFiltersLegend")}
              aria-expanded={columnMenuOpen}
              aria-haspopup="dialog"
              title={t("deck.columnFiltersHint")}
              className="flex w-[min(14rem,calc(100vw-8rem))] min-w-[10rem] items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-left text-sm text-stone-900 shadow-sm hover:border-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              onClick={() => setColumnMenuOpen((o) => !o)}
            >
              <span className="min-w-0 flex-1 truncate">{columnFilterSummary}</span>
              <span className="shrink-0 text-stone-400" aria-hidden>
                ▾
              </span>
            </button>
            {columnMenuOpen ? (
              <div
                className="absolute left-0 z-50 mt-1 w-max min-w-full max-w-[18rem] rounded-lg border border-stone-200 bg-white py-2 shadow-lg"
                role="dialog"
                aria-label={t("deck.columnFiltersLegend")}
              >
                <div className="px-2">
                  <p className="mb-2 px-2 text-xs text-stone-500">{t("deck.columnFiltersHint")}</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.mc}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, mc: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showMcColumn")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.keywords}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, keywords: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showKeywordsColumn")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.instruction}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, instruction: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showInstructionColumn")}
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-stone-200 bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">{t("deck.description")}</th>
                <th className="p-2 font-medium">{t("deck.explanation")}</th>
                {columnFilters.mc ? (
                  <th className="p-2 font-medium">MC 1–4</th>
                ) : null}
                {columnFilters.keywords ? (
                  <th className="p-2 font-medium min-w-[6rem]">{t("deck.keywords")}</th>
                ) : null}
                {columnFilters.instruction ? (
                  <th className="p-2 font-medium">{t("deck.instruction")}</th>
                ) : null}
                <th className="p-2 font-medium">{t("deck.picture")}</th>
                <th className="w-24 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {deck.items.map((item, i) => (
                <tr
                  key={item.id}
                  ref={i === deck.items.length - 1 ? lastRowRef : undefined}
                  className="border-b border-stone-100"
                >
                  <td className="p-2 text-stone-500">{i + 1}</td>
                  <td className="p-2">
                    <ExpandableField
                      readOnly={deckLocked}
                      value={item.description}
                      onChange={(v) =>
                        updateItem(i, { ...item, description: v })
                      }
                      placeholder={t("deck.questionPlaceholder")}
                      compactClassName="w-full min-w-[8rem]"
                      saveOnEnter={false}
                      keywordTagging={{
                        keywords: item.keywords ?? "",
                        onKeywordsChange: (next) =>
                          updateItem(i, { ...item, keywords: next }),
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <ExpandableField
                      readOnly={deckLocked}
                      value={item.explanation}
                      onChange={(v) =>
                        updateItem(i, { ...item, explanation: v })
                      }
                      placeholder={t("deck.answerPlaceholder")}
                      compactClassName="w-full min-w-[8rem]"
                      saveOnEnter={false}
                      keywordTagging={{
                        keywords: item.keywords ?? "",
                        onKeywordsChange: (next) =>
                          updateItem(i, { ...item, keywords: next }),
                      }}
                      dictation={deckLocked ? undefined : {}}
                    />
                  </td>
                  {columnFilters.mc ? (
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <ExpandableField
                            key={n}
                            readOnly={deckLocked}
                            value={
                              item[
                                `multiplechoice${n}` as keyof PStudyItem
                              ] as string
                            }
                            onChange={(v) =>
                              updateItem(i, {
                                ...item,
                                [`multiplechoice${n}`]: v,
                              })
                            }
                            placeholder={`MC ${n}`}
                            rows={3}
                            compactRows={1}
                            compactClassName="min-w-[6rem] text-xs py-0.5"
                          />
                        ))}
                      </div>
                    </td>
                  ) : null}
                  {columnFilters.keywords ? (
                    <td className="p-2">
                      <input
                        type="text"
                        readOnly={deckLocked}
                        value={item.keywords ?? ""}
                        onChange={(e) =>
                          updateItem(i, { ...item, keywords: e.target.value })
                        }
                        placeholder={t("deck.keywordsPlaceholder")}
                        className={`w-full min-w-[6rem] rounded border px-2 py-1 text-sm ${
                          deckLocked
                            ? "cursor-default border-stone-100 bg-stone-50 text-stone-700"
                            : "border-stone-300 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                        }`}
                        title={t("deck.keywordsHint")}
                      />
                    </td>
                  ) : null}
                  {columnFilters.instruction ? (
                    <td className="p-2">
                      <ExpandableField
                        readOnly={deckLocked}
                        value={item.instruction}
                        onChange={(v) =>
                          updateItem(i, { ...item, instruction: v })
                        }
                        placeholder={t("deck.instructionPlaceholder")}
                        rows={3}
                        compactClassName="w-full min-w-[6rem]"
                        onApplyToAll={
                          deckLocked
                            ? undefined
                            : (v) => fillInstructionForAll(v)
                        }
                        applyToAllLabel={t("deck.fillThisInstructionForAll")}
                      />
                    </td>
                  ) : null}
                  <td className="p-2">
                    <PictureUpload
                      readOnly={deckLocked}
                      value={item.picture_url}
                      onChange={(url) =>
                        updateItem(i, { ...item, picture_url: url })
                      }
                    />
                  </td>
                  <td className="p-2">
                    {!deckLocked ? (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-600 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <ConfirmModal
        open={removeItemIndex !== null}
        onClose={() => setRemoveItemIndex(null)}
        onConfirm={confirmRemoveItem}
        title={t("deck.removeItemConfirm")}
        confirmLabel={t("common.remove")}
      />

      {reviewInviteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setReviewInviteOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-invite-dialog-title"
          >
            <h2
              id="review-invite-dialog-title"
              className="flex flex-wrap items-center gap-2 text-lg font-semibold text-stone-900"
            >
              {t("deckReview.requestTitle")}
              <ContextHint>
                <p className="m-0 text-sm">{t("deckReview.requestHint")}</p>
              </ContextHint>
            </h2>
            <div className="mt-4">
              <label htmlFor="review-email" className="mb-1 block text-xs font-medium text-stone-600">
                {t("deckReview.reviewerEmail")}
              </label>
              <input
                id="review-email"
                type="email"
                value={reviewEmail}
                onChange={(e) => setReviewEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder={t("deckReview.reviewerEmailPlaceholder")}
                className="w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendReviewInvite();
                  }
                }}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewInviteOpen(false)}
                className="btn-secondary"
                disabled={reviewSending}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void sendReviewInvite()}
                disabled={reviewSending}
                className="btn-primary disabled:opacity-50"
              >
                {reviewSending ? t("deckReview.sending") : t("deckReview.sendInvite")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
