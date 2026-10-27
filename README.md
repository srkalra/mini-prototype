# Garmin Connect prototype: "Doesn't feel right?" stress feedback

A clickable prototype for ENTR 222 of a new feature in the Garmin Connect phone app. Users can flag a stress reading that doesn't match how they feel (for example, "Garmin says medium stress, I feel fine") so the app can learn from it. Each reading also shows a confidence range.

This is a class project. It is not affiliated with or made by Garmin, and all the data is made up.

## Versions

- **Version 1** (`/`): the first mockup, with a "My Day" home screen.
- **Version 2** (`/v2/`): restyled to match the current Garmin Connect app more closely. It has the newer Home screen (Today's Activity, swipeable In Focus cards, and an At a Glance tile grid), a round stress gauge with the likely range drawn on it, and Garmin's blue/orange stress chart. Open it from the **Stress** tile under At a Glance.

## Try it

Open `index.html` in a browser (or the GitHub Pages link). On a laptop it appears inside a phone frame; on a phone it fills the screen.

1. On **My Day**, tap the **Stress** card.
2. The reading at the top now shows a **likely range** and a **confidence level**. Tap any bar in the chart to see that reading.
3. Tap **Doesn't feel right?**, pick how you actually feel, optionally add reasons and a note, and send.
4. The reading gets a flag, and the **Personalizing your stress** card counts your check-ins toward a personalized baseline.

Use **Reset demo** at the bottom of the Stress screen to clear your feedback.

## What's new compared to the real app

- **Likely range and confidence** on each stress reading (e.g. "49–67, Moderate confidence"), with a short reason why.
- **"Doesn't feel right?" button** that opens a feedback sheet.
- **Flags on the chart** for readings you've given feedback on.
- **Personalizing your stress** card that shows the app learning from your feedback.

## Files

- `index.html`: the screens (My Day, Stress, feedback sheet)
- `style.css`: the dark Garmin Connect–style look
- `script.js`: the fake stress data, chart drawing, and feedback logic
