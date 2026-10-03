# Student YouTube sharing audit

Reviewed 2026-10-02 against the official [player parameters](https://developers.google.com/youtube/player_parameters), [IFrame API](https://developers.google.com/youtube/iframe_api_reference), and [developer policies](https://developers.google.com/youtube/terms/developer-policies).

## Existing behavior

The lesson uses the official IFrame API with `origin`, `playsinline=1`, `rel=0`, and the saved progress position as `start`. Only the video ID, lesson ID, title, safe display watermark, resume position and completion flag cross the player component boundary. The application does not render a video source URL, an Open on YouTube link, or a video Copy/Share action. Resource downloads use authorized application routes.

## Supported changes and limits

- Added `iv_load_policy=3`: YouTube documents this as disabling annotations by default. This is a limited reduction in optional chrome/navigation opportunities where annotations apply; it does not remove cards, end screens, branding, title/channel links or native Share. Many videos may show no visible difference.
- Retained `rel=0`: recommendations are limited to the video's channel. Recommendations cannot be disabled through this parameter.
- Retained inline mobile playback and explicitly retained native controls, keyboard controls and fullscreen (`controls=1`, `disablekb=0`, `fs=1`). Hiding controls would reduce essential playback access and is not a reliable Share-removal mechanism.
- No supported parameter or IFrame API method disables native Share or all YouTube navigation. The iframe may still offer a copyable YouTube link. The embed URL and video ID necessarily remain inspectable in the browser, and the API loader requires a YouTube script URL.
- `modestbranding` has no effect; `showinfo` and `autohide` are deprecated. None were added. Privacy-enhanced hosting is not a Share-removal feature.

## Watermark and authorization

The existing `For Ali` style watermark remains in the same dark player container, immediately above the iframe in its own responsive band. It alternates alignment every 30 seconds and stays at the left under reduced motion, including when that preference changes during playback. Keeping it outside the iframe avoids obscuring any video or YouTube controls. Its placement needs no change. It uses a bounded display name or masked email fallback, without internal IDs or secrets. It is a deterrent only, does not prevent recording, and is outside the native iframe fullscreen view.

Server authorization is unchanged: an active student, a published lesson, and an active enrollment selected for that student and the lesson's exact course are required, with an inclusive start time and exclusive expiry time. Playback progress, resume and completion use the existing authorized endpoint.

## Verification scope

Focused tests cover player configuration, source URL absence outside the iframe, application action absence, the separate watermark band, movement and live reduced-motion changes, fluid viewport classes, progress/resume/completion, and authorization denial. Component layout assertions do not replace real browser checks; mocked player tests cannot establish YouTube's live native UI. The official API documentation establishes the configuration limits. No DRM or perfect anti-sharing protection is provided.
