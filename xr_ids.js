/*
 * GENERATED FILE -- DO NOT EDIT.
 *
 * Source of truth: schemas/ids.yaml
 * Regenerate:      python scripts/generate_ids.py
 *
 * Editing this file by hand is exactly the failure it exists to
 * prevent: four hand-maintained copies of one table, three of them
 * quietly wrong. Change the registry instead.
 */

(function (root) {
  'use strict';

  var VERSION = 1;

  /* capabilities */
  var CAPABILITIES = [
    { id: 0, name: "POINT_RELATIVE_2D",       label: "Relative pointer" },
    { id: 1, name: "POINT_ABSOLUTE_2D",       label: "Absolute pointer" },
    { id: 2, name: "FORCE_2D",                label: "2D force" },
    { id: 3, name: "SCROLL_1D",               label: "Scroll" },
    { id: 4, name: "SCROLL_2D",               label: "Scroll 2D" },
    { id: 5, name: "BUTTON",                  label: "Button" },
    { id: 6, name: "PRESSURE_1D",             label: "Pressure" },
    { id: 7, name: "TOUCH_POSITION",          label: "Touch position" },
    { id: 8, name: "TOUCH_CONTACT",           label: "Touch contact" },
    { id: 9, name: "PROXIMITY",               label: "Proximity" },
    { id: 10, name: "ORIENTATION",             label: "Orientation" },
    { id: 11, name: "ANGULAR_RATE",            label: "Angular rate" },
    { id: 12, name: "ACCELERATION",            label: "Acceleration" },
    { id: 13, name: "GESTURE",                 label: "Gesture" },
    { id: 14, name: "BATTERY_STATUS",          label: "Battery status" },
    { id: 15, name: "POWER_STATUS",            label: "Power status" },
    { id: 16, name: "SYSTEM_STATUS",           label: "System status" },
    { id: 17, name: "AUDIO_LEVEL",             label: "Audio level" },
  ];

  /* gestures */
  var GESTURES = [
    { id: 0, name: "NONE",                    label: "None" },
    { id: 1, name: "TAP",                     label: "Tap" },
    { id: 2, name: "DOUBLE_TAP",              label: "Double tap" },
    { id: 3, name: "LONG_PRESS",              label: "Tap & hold" },
    { id: 4, name: "SWIPE_LEFT",              label: "Swipe left" },
    { id: 5, name: "SWIPE_RIGHT",             label: "Swipe right" },
    { id: 6, name: "SWIPE_UP",                label: "Swipe up" },
    { id: 7, name: "SWIPE_DOWN",              label: "Swipe down" },
    { id: 8, name: "TWO_FINGER_TAP",          label: "2-finger tap" },
    { id: 9, name: "WAKE_WORD",               label: "Wake word" },
    { id: 10, name: "TWO_FINGER_SWIPE_LEFT",   label: "2F swipe left" },
    { id: 11, name: "TWO_FINGER_SWIPE_RIGHT",  label: "2F swipe right" },
    { id: 12, name: "TWO_FINGER_SWIPE_UP",     label: "2F swipe up" },
    { id: 13, name: "TWO_FINGER_SWIPE_DOWN",   label: "2F swipe down" },
    { id: 14, name: "ZOOM_IN",                 label: "Zoom in" },
    { id: 15, name: "ZOOM_OUT",                label: "Zoom out" },
  ];

  /* actions */
  var ACTIONS = [
    { id: 0, name: "NONE",                    label: "None" },
    { id: 1, name: "CURSOR_MOVE",             label: "Move cursor" },
    { id: 2, name: "SCROLL_VERTICAL",         label: "Scroll vertical" },
    { id: 3, name: "SCROLL_HORIZONTAL",       label: "Scroll horizontal" },
    { id: 4, name: "LEFT_CLICK",              label: "Left click" },
    { id: 5, name: "RIGHT_CLICK",             label: "Right click" },
    { id: 6, name: "MIDDLE_CLICK",            label: "Middle click" },
    { id: 7, name: "BUTTON_PRESS",            label: "Button press" },
    { id: 8, name: "BUTTON_RELEASE",          label: "Button release" },
    { id: 9, name: "DRAG_START",              label: "Drag start" },
    { id: 10, name: "DRAG_END",                label: "Drag end" },
    { id: 11, name: "CLUTCH_PRESS",            label: "Clutch press" },
    { id: 12, name: "CLUTCH_RELEASE",          label: "Clutch release" },
    { id: 13, name: "XR_RAY_MOVE",             label: "XR ray move" },
    { id: 14, name: "XR_SELECT",               label: "XR select" },
    { id: 15, name: "MODE_SWITCH",             label: "Mode switch" },
    { id: 16, name: "PROFILE_SWITCH",          label: "Profile switch" },
    { id: 17, name: "SHORTCUT",                label: "Shortcut" },
    { id: 18, name: "MACRO",                   label: "Macro" },
    { id: 19, name: "SYSTEM_SLEEP",            label: "Sleep" },
    { id: 20, name: "SYSTEM_WAKE",             label: "Wake" },
    { id: 21, name: "PAIRING_START",           label: "Start pairing" },
    { id: 22, name: "SCROLL_UP_STEP",          label: "Scroll up one" },
    { id: 23, name: "SCROLL_DOWN_STEP",        label: "Scroll down one" },
    { id: 24, name: "VOLUME_UP",               label: "Volume up" },
    { id: 25, name: "VOLUME_DOWN",             label: "Volume down" },
    { id: 26, name: "MUTE",                    label: "Mute" },
    { id: 27, name: "PLAY_PAUSE",              label: "Play / pause" },
    { id: 28, name: "NEXT_TRACK",              label: "Next track" },
    { id: 29, name: "PREV_TRACK",              label: "Previous track" },
    { id: 30, name: "CAMERA_SHUTTER",          label: "Camera shutter" },
    { id: 31, name: "SNIPER",                  label: "Sniper (hold)" },
    { id: 32, name: "SPEED_CYCLE",             label: "Cycle speed" },
    { id: 33, name: "MACRO_1",                 label: "Macro 1" },
    { id: 34, name: "MACRO_2",                 label: "Macro 2" },
    { id: 35, name: "MACRO_3",                 label: "Macro 3" },
    { id: 36, name: "MACRO_4",                 label: "Macro 4" },
    { id: 37, name: "HOST_CYCLE",              label: "Next host" },
  ];

  /* logical_controls */
  var LOGICAL_CONTROLS = [
    { id: 0, name: "NONE",                    label: "None" },
    { id: 1, name: "POINTING_PRIMARY",        label: "Primary pointer" },
    { id: 2, name: "SCROLL_PRIMARY",          label: "Primary scroll" },
    { id: 3, name: "TOUCH_PRIMARY",           label: "Primary touch" },
    { id: 4, name: "MOTION_PRIMARY",          label: "Primary motion" },
    { id: 5, name: "BUTTON_PRIMARY",          label: "Primary button" },
    { id: 6, name: "BUTTON_SECONDARY",        label: "Secondary button" },
    { id: 7, name: "BUTTON_TERTIARY",         label: "Tertiary button" },
    { id: 8, name: "SELECTOR",                label: "Selector" },
    { id: 9, name: "VOICE_PRIMARY",           label: "Voice" },
  ];

  /* status */
  var STATUS = [
    { id: 0, name: "OK",                      label: "OK" },
    { id: 1, name: "INVALID_ARG",             label: "Invalid argument" },
    { id: 2, name: "NOT_READY",               label: "Not ready" },
    { id: 3, name: "NOT_SUPPORTED",           label: "Not supported" },
    { id: 4, name: "TIMEOUT",                 label: "Timeout" },
    { id: 5, name: "BUS",                     label: "Bus error" },
    { id: 6, name: "CRC",                     label: "CRC error" },
    { id: 7, name: "NO_DEVICE",               label: "No device" },
    { id: 8, name: "BAD_STATE",               label: "Bad state" },
    { id: 9, name: "QUEUE_FULL",              label: "Queue full" },
    { id: 10, name: "STORAGE",                 label: "Storage error" },
    { id: 11, name: "AUTH",                    label: "Not authorized" },
    { id: 12, name: "CONFLICT",                label: "Revision conflict" },
    { id: 13, name: "VERSION",                 label: "Version mismatch" },
    { id: 14, name: "CORRUPT",                 label: "Corrupt data" },
    { id: 15, name: "RETRY",                   label: "Retry" },
  ];

  function byId(list, field) {
    var m = {};
    for (var i = 0; i < list.length; i++) m[list[i].id] = list[i][field];
    return m;
  }

  root.XR_IDS = {
    VERSION: VERSION,
    CAPABILITIES: CAPABILITIES,
    CAPABILITIES_LABEL: byId(CAPABILITIES, 'label'),
    CAPABILITIES_NAME: byId(CAPABILITIES, 'name'),
    GESTURES: GESTURES,
    GESTURES_LABEL: byId(GESTURES, 'label'),
    GESTURES_NAME: byId(GESTURES, 'name'),
    ACTIONS: ACTIONS,
    ACTIONS_LABEL: byId(ACTIONS, 'label'),
    ACTIONS_NAME: byId(ACTIONS, 'name'),
    LOGICAL_CONTROLS: LOGICAL_CONTROLS,
    LOGICAL_CONTROLS_LABEL: byId(LOGICAL_CONTROLS, 'label'),
    LOGICAL_CONTROLS_NAME: byId(LOGICAL_CONTROLS, 'name'),
    STATUS: STATUS,
    STATUS_LABEL: byId(STATUS, 'label'),
    STATUS_NAME: byId(STATUS, 'name'),
  };
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof self !== 'undefined' ? self : this);
