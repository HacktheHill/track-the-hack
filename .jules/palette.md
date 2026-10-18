## 2024-03-24 - Missing `type="search"` in Search Inputs
**Learning:** Search inputs in the hardware and internal hardware pages use a standard text input `<input ... placeholder={t("search")} />` instead of `<input type="search" />`. Using `type="search"` improves UX on mobile by showing a dedicated search key on the virtual keyboard and enables the native browser "clear" (x) button.
**Action:** Add `type="search"` to all search inputs.
