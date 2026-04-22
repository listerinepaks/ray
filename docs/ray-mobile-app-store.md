# Ray Mobile — App Store listing notes

**Quick reference (App Store Connect)**

| Field | Value |
|--------|--------|
| **Name** | Ray Mobile |
| **SKU** | `raymobile` |

## App name (App Store Connect)

**Ray** was not available on the App Store, so the listing name should be:

- **Ray Mobile**

Use this as the **App Name** (what users see under the icon on the home screen and in search results), subject to Apple’s review and your final branding.

## SKU (App Store Connect)

The **SKU** is an internal identifier you pick when creating the app; it is **not** shown to customers and **cannot be changed** after creation.

- **SKU:** `raymobile`

## Bundle ID (Apple Developer + App Store Connect)

Use the same identifier for the iOS app record and in Expo (`ios.bundleIdentifier`):

- **Bundle ID:** `com.listerinepaks.raymobile`

This should match your Android application ID (`android.package` in `app.json`) so both stores use one consistent reverse-DNS id.

## Subtitle (App Store Connect)

The **subtitle** is configured in App Store Connect (not in `app.json`). It is optional but recommended. **Maximum 30 characters.**

**Chosen subtitle:** **Sunrise & sunset journal** (24 characters)

## Third-party content (App Review — rights / permissions)

Apple may reject or question apps that **show or access third-party content** unless you have the **rights or legal permission** to use that content in every country where the app is offered. That wording maps to guidelines around intellectual property and licensed material (often discussed alongside **5.2** in review).

For **Ray Mobile**, be ready to explain (in **App Review Notes** and, where needed, in your **Terms / Privacy**):

| Kind of content | What to have straight |
|-----------------|------------------------|
| **User photos and text (“moments”)** | Users should grant you a license in **Terms of Use** (or equivalent) to host, process, and display their uploads on your service. If moments can be **visible to other users**, spell out visibility, consent, and any **reporting / removal** expectations; Apple cares more when content is shared or discoverable. |
| **Sunrise/sunset** | Ray Mobile does **not** call a third-party sunrise/sunset API. Times are **computed in the app** from the user’s coordinates (standard astronomical formulas) after **on-device location** permission. For review, you can say there is **no licensed weather or sun-times feed**—only the user’s location and local math. |
| **Branding & typography** | **Branding** (wordmark, icons, splash, and other Ray visuals) is **your own**. **Fonts** are **Google Fonts** embedded in the app via `@expo-google-fonts` (e.g. Inter, Playfair Display)—bundled with the binary, not fetched from a live third-party content API. Use each font according to its **Google Fonts / font license** (many are **SIL Open Font License**); check [fonts.google.com](https://fonts.google.com) for any font you add later. |
| **Other people’s profiles or links** | Only show what your **product and agreements** allow (e.g. data your users are allowed to share, or public info you have permission to surface). |

This is **not** unique to Ray; it is standard for any app with UGC or external data. If Apple asks, a short, factual **Review Notes** paragraph (“All displayed media is user-uploaded under our Terms; we operate the API at …”) plus defensible **legal terms** is usually enough when you are not scraping or redistributing someone else’s catalog without a license.

## Listing copy drafts (App Store Connect)

Character limits are Apple’s; trim if Connect rejects a line.

### Promotional text (max **170** — editable anytime)

> Photo-first moments around sunrise and sunset. Today’s sun times use your location on-device—no weather feed. Keep entries private or share with people you trust.

*(162 characters as written; under Apple’s 170 limit. Swap “people you trust” → “friends and family” if you prefer a warmer tone.)*

### Description (max **4,000**)

**Ray Mobile** is a calm place to save the day in pictures and words—especially around **sunrise** and **sunset**, and the ordinary moments in between.

**What you can do**

- **Capture moments** with photos and a short story. Mark a moment as sunrise, sunset, or something else that fits your day.
- **See today’s sunrise and sunset** based on where you are. Times are calculated on your device from your coordinates—no separate sun or weather service.
- **Keep things yours** or **invite others** when a moment is meant to be shared. You stay in control of who can view or join the conversation.

Sign in with the same account you use for Ray on the web. (Your organization runs the Ray service; this app is the mobile companion.)

---

*You can shorten the last paragraph if you ship a public hosted Ray later.*

### Keywords (max **100** total, commas only, **no spaces** after commas)

```
journal,sunrise,sunset,photo,diary,moments,memories,private,nature,sharing,mindfulness,gratitude
```

*(96 characters—room to add one short word, e.g. `,sky`, if you want to use the full budget.)*

### What’s New (per submission; example **1.0.0**)

> Welcome to Ray Mobile on the App Store. Capture sunrise, sunset, and everyday moments with photos and notes, see today’s sun times from your location, and share only when you want to.

### Other Connect fields (not customer-facing prose, but required or common)

| Field | Notes |
|--------|--------|
| **Support URL** | Required. Use a page with contact or help (e.g. `https://…/support` or your main site). |
| **Marketing URL** | Optional. Often your product or landing page. |
| **Privacy Policy URL** | Required for most apps with accounts or uploads. Host the policy that matches your data practices. |
| **Copyright** | e.g. `© 2026 [Your legal name or company]` — must match what you want on the store listing. |

## Technical name vs store name

- **Store listing name:** Ray Mobile (above)
- **Expo `expo.name` / internal project name:** can stay `ray-mobile` or be aligned later; it does not have to match the App Store name exactly.

## Local build reminder

After changing icons/splash paths in `app.json`, run a fresh native project generation before local Xcode builds:

```bash
cd ray-mobile
npx expo prebuild --clean
```
