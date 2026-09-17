/* Generated from the vendored source registrations; do not hand edit. */
export type CapturedSourceProperty = { name?: unknown; key?: unknown; htmlAttr?: unknown; child?: unknown; inputtype?: unknown; options?: readonly Record<string, unknown>[]; validValues?: readonly unknown[] };
export type CapturedSourceDefinition = { type: string; parent: string | null; name?: unknown; html?: unknown; nodes?: readonly string[] | null; attributes?: readonly string[] | Readonly<Record<string, string>> | null; classes?: readonly string[] | null; classesRegex?: readonly string[] | null; resizable?: boolean; properties: readonly CapturedSourceProperty[]; hasInit: boolean; hasOnChange: boolean };
export const UVS_SOURCE_CAPTURE: readonly CapturedSourceDefinition[] = [
  {
    "type": "_base",
    "parent": null,
    "name": "Element",
    "properties": [
      {
        "name": false,
        "key": "element_header",
        "inputtype": "SectionInput"
      },
      {
        "name": "Id",
        "key": "id",
        "htmlAttr": "id",
        "inputtype": "TextInput"
      },
      {
        "name": "Title",
        "key": "title",
        "htmlAttr": "title",
        "inputtype": "TextInput"
      },
      {
        "name": "Class",
        "key": "class",
        "htmlAttr": "class",
        "inputtype": "TagsInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "config/bootstrap",
    "parent": null,
    "name": "Bootstrap Variables",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/heading",
    "parent": "_base",
    "name": "Heading",
    "html": "<h1>Heading</h1>",
    "nodes": [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6"
    ],
    "properties": [
      {
        "name": "Size",
        "key": "size",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "1",
            "text": "Heading 1"
          },
          {
            "value": "2",
            "text": "Heading 2"
          },
          {
            "value": "3",
            "text": "Heading 3"
          },
          {
            "value": "4",
            "text": "Heading 4"
          },
          {
            "value": "5",
            "text": "Heading 5"
          },
          {
            "value": "6",
            "text": "Heading 6"
          }
        ]
      },
      {
        "name": "Text",
        "key": "innerHTML",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/link",
    "parent": "_base",
    "name": "Link",
    "html": "<a href=\"#\" rel=\"noopener\">Link Text</a>",
    "nodes": [
      "a"
    ],
    "properties": [
      {
        "name": "Url",
        "key": "href",
        "htmlAttr": "href",
        "inputtype": "AutocompleteInput"
      },
      {
        "name": "Rel",
        "key": "rel",
        "htmlAttr": "rel",
        "inputtype": "LinkInput"
      },
      {
        "name": "Text",
        "key": "innerHTML",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      },
      {
        "name": "Target",
        "key": "target",
        "htmlAttr": "target",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": ""
          },
          {
            "value": "_blank",
            "text": "Blank"
          },
          {
            "value": "_parent",
            "text": "Parent"
          },
          {
            "value": "_self",
            "text": "Self"
          },
          {
            "value": "_top",
            "text": "Top"
          }
        ]
      },
      {
        "name": "Download",
        "key": "download",
        "htmlAttr": "download",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/image",
    "parent": "_base",
    "name": "Image",
    "html": "<img src=\"/icons/image.svg\" width=\"200\" class=\"img-fluid align-center\">",
    "nodes": [
      "img"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Image",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "ImageInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "NumberInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "NumberInput"
      },
      {
        "name": "Alt",
        "key": "alt",
        "htmlAttr": "alt",
        "inputtype": "TextInput"
      },
      {
        "name": "Align",
        "key": "align",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "align-left",
            "title": "text-start",
            "icon": "la la-align-left",
            "checked": false
          },
          {
            "value": "align-center",
            "title": "Center",
            "icon": "la la-align-center",
            "checked": false
          },
          {
            "value": "align-right",
            "title": "Right",
            "icon": "la la-align-right",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "align-left",
          "align-center",
          "align-right"
        ]
      },
      {
        "key": "link_options",
        "inputtype": "SectionInput"
      },
      {
        "name": "Enable link",
        "key": "enable_link",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Url",
        "key": "href",
        "htmlAttr": "href",
        "inputtype": "AutocompleteInput"
      },
      {
        "name": "Rel",
        "key": "rel",
        "htmlAttr": "rel",
        "inputtype": "LinkInput"
      },
      {
        "name": "Text",
        "key": "innerHTML",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      },
      {
        "name": "Target",
        "key": "target",
        "htmlAttr": "target",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": ""
          },
          {
            "value": "_blank",
            "text": "Blank"
          },
          {
            "value": "_parent",
            "text": "Parent"
          },
          {
            "value": "_self",
            "text": "Self"
          },
          {
            "value": "_top",
            "text": "Top"
          }
        ]
      },
      {
        "name": "Download",
        "key": "download",
        "htmlAttr": "download",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": false
  },
  {
    "type": "html/hr",
    "parent": "_base",
    "name": "Horizontal Rule",
    "html": "<hr class=\"border-primary border-4 opacity-25\">",
    "nodes": [
      "hr"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "border-color",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "border-primary",
            "text": "Primary"
          },
          {
            "value": "border-secondary",
            "text": "Secondary"
          },
          {
            "value": "border-success",
            "text": "Success"
          },
          {
            "value": "border-danger",
            "text": "Danger"
          },
          {
            "value": "border-warning",
            "text": "Warning"
          },
          {
            "value": "border-info",
            "text": "Info"
          },
          {
            "value": "border-light",
            "text": "Light"
          },
          {
            "value": "border-dark",
            "text": "Dark"
          },
          {
            "value": "border-white",
            "text": "White"
          }
        ],
        "validValues": [
          "border-primary",
          "border-secondary",
          "border-success",
          "border-danger",
          "border-warning",
          "border-info",
          "border-light",
          "border-dark",
          "border-white"
        ]
      },
      {
        "name": "Border",
        "key": "border-size",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "border-1",
            "text": "Size 1"
          },
          {
            "value": "border-2",
            "text": "Size 2"
          },
          {
            "value": "border-3",
            "text": "Size 3"
          },
          {
            "value": "border-4",
            "text": "Size 4"
          },
          {
            "value": "border-5",
            "text": "Size 5"
          }
        ],
        "validValues": [
          "border-1",
          "border-2",
          "border-3",
          "border-4",
          "border-5"
        ]
      },
      {
        "name": "Opacity",
        "key": "opacity",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "opacity-25",
            "text": "Opacity 25%"
          },
          {
            "value": "opacity-50",
            "text": "Opacity 50%"
          },
          {
            "value": "opacity-75",
            "text": "Opacity 75%"
          },
          {
            "value": "opacity-100",
            "text": "Opacity 100%"
          }
        ],
        "validValues": [
          "opacity-25",
          "opacity-50",
          "opacity-75",
          "opacity-100"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/label",
    "parent": "_base",
    "name": "Label",
    "html": "<label for=\"\">Label</label>",
    "nodes": [
      "label"
    ],
    "properties": [
      {
        "name": "For id",
        "key": "for",
        "htmlAttr": "for",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/textinput",
    "parent": "_base",
    "name": "Input",
    "html": "<input type=\"text\" class=\"form-control\">",
    "nodes": [
      "input"
    ],
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Value",
        "key": "value",
        "htmlAttr": "value",
        "inputtype": "TextInput"
      },
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "type",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "text",
            "text": "text"
          },
          {
            "value": "button",
            "text": "button"
          },
          {
            "value": "checkbox",
            "text": "checkbox"
          },
          {
            "value": "color",
            "text": "color"
          },
          {
            "value": "date",
            "text": "date"
          },
          {
            "value": "datetime-local",
            "text": "datetime-local"
          },
          {
            "value": "email",
            "text": "email"
          },
          {
            "value": "file",
            "text": "file"
          },
          {
            "value": "hidden",
            "text": "hidden"
          },
          {
            "value": "image",
            "text": "image"
          },
          {
            "value": "month",
            "text": "month"
          },
          {
            "value": "number",
            "text": "number"
          },
          {
            "value": "password",
            "text": "password"
          },
          {
            "value": "radio",
            "text": "radio"
          },
          {
            "value": "range",
            "text": "range"
          },
          {
            "value": "reset",
            "text": "reset"
          },
          {
            "value": "search",
            "text": "search"
          },
          {
            "value": "submit",
            "text": "submit"
          },
          {
            "value": "tel",
            "text": "tel"
          },
          {
            "value": "text",
            "text": "text"
          },
          {
            "value": "time",
            "text": "time"
          },
          {
            "value": "url",
            "text": "url"
          },
          {
            "value": "week",
            "text": "week"
          }
        ]
      },
      {
        "name": "Placeholder",
        "key": "placeholder",
        "htmlAttr": "placeholder",
        "inputtype": "TextInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Required",
        "key": "required",
        "htmlAttr": "required",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/selectinput",
    "parent": "_base",
    "name": "Select Input",
    "html": "<select class=\"form-control\"><option value=\"value1\">Text 1</option><option value=\"value2\">Text 2</option><option value=\"value3\">Text 3</option></select>",
    "nodes": [
      "select"
    ],
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Required",
        "key": "required",
        "htmlAttr": "required",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Option",
        "key": "option1",
        "inputtype": "TextValueInput"
      },
      {
        "name": "Option",
        "key": "option2",
        "inputtype": "TextValueInput"
      },
      {
        "name": "",
        "key": "addChild",
        "inputtype": "ButtonInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/textareainput",
    "parent": "_base",
    "name": "Text Area",
    "html": "<textarea class=\"form-control\"></textarea>",
    "nodes": [
      "textarea"
    ],
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Value",
        "key": "value",
        "htmlAttr": "value",
        "inputtype": "TextInput"
      },
      {
        "name": "Placeholder",
        "key": "placeholder",
        "htmlAttr": "placeholder",
        "inputtype": "TextInput"
      },
      {
        "name": "Columns",
        "key": "cols",
        "htmlAttr": "cols",
        "inputtype": "NumberInput"
      },
      {
        "name": "Rows",
        "key": "rows",
        "htmlAttr": "rows",
        "inputtype": "NumberInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Required",
        "key": "required",
        "htmlAttr": "required",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/radiobutton",
    "parent": "_base",
    "name": "Radio Button",
    "html": "<div class=\"form-check\">\n\t\t\t  <label class=\"form-check-label\">\n\t\t\t\t<input class=\"form-check-input\" type=\"radio\" name=\"radiobutton\"> Option 1\n\t\t\t  </label>\n\t\t\t</div>\n\t\t\t<div class=\"form-check\">\n\t\t\t  <label class=\"form-check-label\">\n\t\t\t\t<input class=\"form-check-input\" type=\"radio\" name=\"radiobutton\" checked> Option 2\n\t\t\t  </label>\n\t\t\t</div>\n\t\t\t<div class=\"form-check\">\n\t\t\t  <label class=\"form-check-label\">\n\t\t\t\t<input class=\"form-check-input\" type=\"radio\" name=\"radiobutton\"> Option 3\n\t\t\t  </label>\n\t\t\t</div>",
    "attributes": {
      "type": "radio"
    },
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Value",
        "key": "value",
        "htmlAttr": "value",
        "inputtype": "TextInput"
      },
      {
        "name": "Checked",
        "key": "checked",
        "htmlAttr": "Checked",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Required",
        "key": "required",
        "htmlAttr": "required",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/checkbox",
    "parent": "_base",
    "name": "Checkbox",
    "html": "<div class=\"form-check\">\n\t\t\t  <label class=\"form-check-label\">\n\t\t\t\t<input class=\"form-check-input\" type=\"checkbox\" value=\"\"> Default checkbox\n\t\t\t  </label>\n\t\t\t</div>",
    "attributes": {
      "type": "checkbox"
    },
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Value",
        "key": "value",
        "htmlAttr": "value",
        "inputtype": "TextInput"
      },
      {
        "name": "Checked",
        "key": "checked",
        "htmlAttr": "Checked",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Required",
        "key": "required",
        "htmlAttr": "required",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/video",
    "parent": "_base",
    "name": "Video",
    "html": "<video width=\"320\" height=\"240\" playsinline loop autoplay muted src=\"../../media/demo/sample.webm\" poster=\"../../media/demo/sample.webp\"><video>",
    "nodes": [
      "video"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Video",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "VideoInput"
      },
      {
        "name": "Poster",
        "key": "poster",
        "htmlAttr": "poster",
        "inputtype": "ImageInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      },
      {
        "name": "Muted",
        "key": "muted",
        "htmlAttr": "muted",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Loop",
        "key": "loop",
        "htmlAttr": "loop",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Autoplay",
        "key": "autoplay",
        "htmlAttr": "autoplay",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Plays inline",
        "key": "playsinline",
        "htmlAttr": "playsinline",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Controls",
        "key": "controls",
        "htmlAttr": "controls",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "",
        "key": "autoplay_warning",
        "inputtype": "NoticeInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/button",
    "parent": "_base",
    "name": "Html Button",
    "html": "<button>Button</button>",
    "nodes": [
      "button"
    ],
    "properties": [
      {
        "name": "Text",
        "key": "text",
        "htmlAttr": "innerHTML",
        "inputtype": "TextInput"
      },
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "name",
        "inputtype": "TextInput"
      },
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "type",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "button",
            "text": "button"
          },
          {
            "value": "reset",
            "text": "reset"
          },
          {
            "value": "submit",
            "text": "submit"
          }
        ]
      },
      {
        "name": "Autofocus",
        "key": "autofocus",
        "htmlAttr": "autofocus",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "disabled",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/paragraph",
    "parent": "_base",
    "name": "Paragraph",
    "html": "<p>Lorem ipsum</p>",
    "nodes": [
      "p"
    ],
    "properties": [
      {
        "name": "Text align",
        "key": "p-text-align",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "text-start",
            "title": "text-start",
            "icon": "la la-align-left",
            "checked": false
          },
          {
            "value": "text-center",
            "title": "Center",
            "icon": "la la-align-center",
            "checked": false
          },
          {
            "value": "text-end",
            "title": "Right",
            "icon": "la la-align-right",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "text-start",
          "text-center",
          "text-end"
        ]
      },
      {
        "name": "Text",
        "key": "innerHTML",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/blockquote",
    "parent": "_base",
    "name": "Blockquote",
    "html": "<blockquote cite=\"https://en.wikipedia.org/wiki/Marcus_Aurelius\">\n\t\t\t\t<p>Today I shall be meeting with interference, ingratitude, insolence, disloyalty, ill-will, and selfishness all of them due to the offenders' ignorance of what is good or evil.</p>\n\t\t\t\t<cite class=\"small\">\n\t\t\t\t\t<a href=\"https://en.wikipedia.org/wiki/Marcus_Aurelius\" class=\"text-decoration-none\" target=\"blank\">Marcus Aurelius</a>\n\t\t\t\t</cite>\t\n\t\t\t</blockquote>",
    "nodes": [
      "blockquote"
    ],
    "properties": [
      {
        "name": "Align",
        "key": "align",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "align-left",
            "title": "text-start",
            "icon": "la la-align-left",
            "checked": false
          },
          {
            "value": "align-center",
            "title": "Center",
            "icon": "la la-align-center",
            "checked": false
          },
          {
            "value": "align-right",
            "title": "Right",
            "icon": "la la-align-right",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "align-left",
          "align-center",
          "align-right"
        ]
      },
      {
        "name": "Cite",
        "key": "cite",
        "htmlAttr": "cite",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/list-item",
    "parent": "_base",
    "name": "List item",
    "html": "<li>List item</li>",
    "nodes": [
      "li"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/list",
    "parent": "_base",
    "name": "List",
    "html": "<ul>\n\t\t\t\t<li>Begin with the possible; begin with one step.</li>\n\t\t\t\t<li>Never think of results, just do!</li>\n\t\t\t\t<li>Patience is the mother of will.</li>\n\t\t\t\t<li>Man must use what he has, not hope for what is not.</li>\n\t\t\t\t<li>Only super-efforts count.</li>\n\t\t\t</ul>",
    "nodes": [
      "ul",
      "ol"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "ul",
            "text": "Unordered"
          },
          {
            "value": "ol",
            "text": "Ordered"
          }
        ]
      },
      {
        "name": "Items",
        "key": "items",
        "htmlAttr": "data-slides-per-view",
        "inputtype": "ListInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/preformatted",
    "parent": "_base",
    "name": "Preformatted",
    "html": "<pre>Today I shall be meeting with interference, \ningratitude, insolence, disloyalty, ill-will, and\nselfishness all of them due to the offenders'\nignorance of what is good or evil..</pre>",
    "nodes": [
      "pre"
    ],
    "properties": [
      {
        "name": "Text",
        "key": "text",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/form",
    "parent": "_base",
    "name": "Form",
    "html": "<form action=\"\" method=\"POST\">\n\t  <div class=\"mb-3\">\n\t\t<label for=\"exampleInputEmail1\" class=\"form-label\">Email address</label>\n\t\t<input type=\"email\" class=\"form-control\" id=\"exampleInputEmail1\" aria-describedby=\"emailHelp\">\n\t\t<div id=\"emailHelp\" class=\"form-text\">We'll never share your email with anyone else.</div>\n\t  </div>\n\t  <div class=\"mb-3\">\n\t\t<label for=\"exampleInputPassword1\" class=\"form-label\">Password</label>\n\t\t<input type=\"password\" class=\"form-control\" id=\"exampleInputPassword1\">\n\t  </div>\n\t  <div class=\"mb-3 form-check\">\n\t\t<input type=\"checkbox\" class=\"form-check-input\" id=\"exampleCheck1\">\n\t\t<label class=\"form-check-label\" for=\"exampleCheck1\">Check me out</label>\n\t  </div>\n\t  <button type=\"submit\" class=\"btn btn-primary\">Submit</button>\n\t</form>",
    "nodes": [
      "form"
    ],
    "properties": [
      {
        "name": "Action",
        "key": "action",
        "htmlAttr": "action",
        "inputtype": "TextInput"
      },
      {
        "name": "Method",
        "key": "method",
        "htmlAttr": "method",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "post",
            "text": "Post"
          },
          {
            "value": "get",
            "text": "Get"
          }
        ]
      },
      {
        "name": "Encoding type",
        "key": "enctype",
        "htmlAttr": "enctype",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": ""
          },
          {
            "value": "application/x-www-form-urlencoded",
            "text": "Url encoded (default)"
          },
          {
            "value": "multipart/form-data",
            "text": "Multipart (for file upload)"
          },
          {
            "value": "text/plain",
            "text": "Text plain"
          }
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tablerow",
    "parent": "_base",
    "name": "Table Row",
    "html": "<tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr>",
    "nodes": [
      "tr"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "success",
            "text": "Success"
          },
          {
            "value": "error",
            "text": "Error"
          },
          {
            "value": "warning",
            "text": "Warning"
          },
          {
            "value": "active",
            "text": "Active"
          }
        ],
        "validValues": [
          "",
          "success",
          "danger",
          "warning",
          "active"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tablecell",
    "parent": "_base",
    "name": "Table Cell",
    "html": "<td>Cell</td>",
    "nodes": [
      "td"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tableheadercell",
    "parent": "_base",
    "name": "Table Header Cell",
    "html": "<th>Head</th>",
    "nodes": [
      "th"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tablebody",
    "parent": "_base",
    "name": "Table Body",
    "html": "<tbody><tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr></tbody>",
    "nodes": [
      "tbody"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tablefooter",
    "parent": "_base",
    "name": "Table Footer",
    "html": "<tfooter>Table footer</tfooter>",
    "nodes": [
      "tfooter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/tablehead",
    "parent": "_base",
    "name": "Table Head",
    "html": "<thead><tr><th>Head 1</th><th>Head 2</th><th>Head 3</th></tr></thead>",
    "nodes": [
      "thead"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "success",
            "text": "Success"
          },
          {
            "value": "anger",
            "text": "Error"
          },
          {
            "value": "warning",
            "text": "Warning"
          },
          {
            "value": "info",
            "text": "Info"
          }
        ],
        "validValues": [
          "",
          "success",
          "danger",
          "warning",
          "info"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/table",
    "parent": "_base",
    "name": "Table",
    "html": "<table class=\"table table-striped table-hover\">\n\t\t\t  <thead>\n\t\t\t\t<tr>\n\t\t\t\t  <th scope=\"col\">#</th>\n\t\t\t\t  <th scope=\"col\">First</th>\n\t\t\t\t  <th scope=\"col\">Last</th>\n\t\t\t\t  <th scope=\"col\">Handle</th>\n\t\t\t\t</tr>\n\t\t\t  </thead>\n\t\t\t  <tbody>\n\t\t\t\t<tr>\n\t\t\t\t  <th scope=\"row\">1</th>\n\t\t\t\t  <td>Mark</td>\n\t\t\t\t  <td>Otto</td>\n\t\t\t\t  <td>@mdo</td>\n\t\t\t\t</tr>\n\t\t\t\t<tr>\n\t\t\t\t  <th scope=\"row\">2</th>\n\t\t\t\t  <td>Jacob</td>\n\t\t\t\t  <td>Thornton</td>\n\t\t\t\t  <td>@fat</td>\n\t\t\t\t</tr>\n\t\t\t\t<tr>\n\t\t\t\t  <th scope=\"row\">3</th>\n\t\t\t\t  <td colspan=\"2\">Larry the Bird</td>\n\t\t\t\t  <td>@twitter</td>\n\t\t\t\t</tr>\n\t\t\t  </tbody>\n\t\t\t</table>",
    "nodes": [
      "table"
    ],
    "classes": [
      "table"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "table-primary",
            "text": "Primary"
          },
          {
            "value": "table-secondary",
            "text": "Secondary"
          },
          {
            "value": "table-success",
            "text": "Success"
          },
          {
            "value": "table-danger",
            "text": "Danger"
          },
          {
            "value": "table-warning",
            "text": "Warning"
          },
          {
            "value": "table-info",
            "text": "Info"
          },
          {
            "value": "table-light",
            "text": "Light"
          },
          {
            "value": "table-dark",
            "text": "Dark"
          },
          {
            "value": "table-white",
            "text": "White"
          }
        ],
        "validValues": [
          "table-primary",
          "table-secondary",
          "table-success",
          "table-danger",
          "table-warning",
          "table-info",
          "table-light",
          "table-dark",
          "table-white"
        ]
      },
      {
        "name": "Responsive",
        "key": "responsive",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-responsive"
        ]
      },
      {
        "name": "Small",
        "key": "small",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-sm"
        ]
      },
      {
        "name": "Hover",
        "key": "hover",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-hover"
        ]
      },
      {
        "name": "Bordered",
        "key": "bordered",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-bordered"
        ]
      },
      {
        "name": "Striped",
        "key": "striped",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-striped"
        ]
      },
      {
        "name": "Inverse",
        "key": "inverse",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "table-inverse"
        ]
      },
      {
        "name": "Head options",
        "key": "head",
        "htmlAttr": "class",
        "child": "thead",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "None"
          },
          {
            "value": "thead-default",
            "text": "Default"
          },
          {
            "value": "thead-inverse",
            "text": "Inverse"
          }
        ],
        "validValues": [
          "",
          "thead-dark",
          "thead-light"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/audio",
    "parent": "_base",
    "name": "Audio",
    "html": "<figure data-component-audio><audio controls src=\"#\"></audio></figure>",
    "nodes": [
      "audio"
    ],
    "attributes": [
      "data-component-audio"
    ],
    "properties": [
      {
        "name": "Src",
        "key": "src",
        "htmlAttr": "src",
        "child": "audio",
        "inputtype": "LinkInput"
      },
      {
        "name": false,
        "key": "audio_options",
        "inputtype": "SectionInput"
      },
      {
        "name": "Autoplay",
        "key": "autoplay",
        "htmlAttr": "autoplay",
        "child": "audio",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Loop",
        "key": "loop",
        "htmlAttr": "loop",
        "child": "audio",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/pdf",
    "parent": "_base",
    "name": "Pdf embed",
    "html": "<object data=\"\" type=\"application/pdf\" data-component-pdf></object>",
    "attributes": [
      "data-component-pdf"
    ],
    "properties": [
      {
        "name": "Data",
        "key": "data",
        "htmlAttr": "data",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/embed",
    "parent": "_base",
    "name": "Embed",
    "html": "<object data=\"\" type=\"application/pdf\" data-component-pdf></object>",
    "attributes": [
      "data-component-embed"
    ],
    "properties": [
      {
        "name": "Data",
        "key": "data",
        "htmlAttr": "data",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/html",
    "parent": "_base",
    "name": "Html Page",
    "html": "<html><body></body></html>",
    "nodes": [
      "html"
    ],
    "properties": [
      {
        "name": "Title",
        "key": "title",
        "htmlAttr": "innerHTML",
        "child": "title",
        "inputtype": "TextInput"
      },
      {
        "name": "Meta description",
        "key": "description",
        "htmlAttr": "content",
        "child": "meta[name=description]",
        "inputtype": "TextInput"
      },
      {
        "name": "Meta keywords",
        "key": "keywords",
        "htmlAttr": "content",
        "child": "meta[name=keywords]",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/iframe",
    "parent": "_base",
    "name": "Iframe",
    "html": "<div data-component-iframe><iframe src=\"https://www.vvveb.com\" width=\"320\" height=\"240\"></iframe></div>",
    "attributes": [
      "data-component-iframe"
    ],
    "properties": [
      {
        "name": "Src",
        "key": "src",
        "htmlAttr": "src",
        "child": "iframe",
        "inputtype": "TextInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "child": "iframe",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "child": "iframe",
        "inputtype": "CssUnitInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/figure",
    "parent": "_base",
    "name": "Figure",
    "html": "<figure>\n\t\t  <img src=\"/icons/image.svg\" alt=\"Trulli\">\n\t\t  <figcaption>Fig.1 - Trulli, Puglia, Italy.</figcaption>\n\t\t  <div class=\"border\"></div>\n\t\t</figure>",
    "nodes": [
      "figure"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Image",
        "key": "src",
        "htmlAttr": "src",
        "child": "img",
        "inputtype": "ImageInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "child": "img",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "child": "img",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Alt",
        "key": "alt",
        "htmlAttr": "alt",
        "child": "img",
        "inputtype": "TextInput"
      },
      {
        "name": "Caption",
        "key": "caption",
        "htmlAttr": "innerHTML",
        "child": "figcaption",
        "inputtype": "TextareaInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/font-icon",
    "parent": "_base",
    "name": "Font Icon",
    "html": "<i class=\"la la-star la-2x\"></i>",
    "classes": [
      "la",
      "lab"
    ],
    "properties": [
      {
        "name": "Icon",
        "key": "icon",
        "inputtype": "HtmlListSelectInput",
        "options": [
          {
            "value": "line-awesome",
            "text": "Line-awesome"
          }
        ]
      },
      {
        "name": "Size",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Normal"
          },
          {
            "value": "la-lg",
            "text": "Large"
          },
          {
            "value": "la-2x",
            "text": "2x"
          }
        ],
        "validValues": [
          "",
          "la-lg",
          "la-2x"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/svg-image",
    "parent": "_base",
    "name": "Svg Image",
    "html": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"64\" height=\"64\">\n\t\t<path d=\"M 30.335938 12.546875 L 20.164063 11.472656 L 16 2.132813 L 11.835938 11.472656 L 1.664063 12.546875 L 9.261719 19.394531 L 7.140625 29.398438 L 16 24.289063 L 24.859375 29.398438 L 22.738281 19.394531 Z\"/>\n    </svg>",
    "nodes": [
      "svg"
    ],
    "properties": [
      {
        "name": "Svg",
        "key": "svg",
        "htmlAttr": "innerHTML",
        "inputtype": "SvgInput"
      },
      {
        "name": "Icon",
        "key": "icon",
        "inputtype": "HtmlListSelectInput",
        "options": [
          {
            "value": "eva-icons",
            "text": "Eva icons"
          },
          {
            "value": "ionicons",
            "text": "IonIcons"
          },
          {
            "value": "linea",
            "text": "Linea"
          },
          {
            "value": "remix-icon",
            "text": "RemixIcon"
          },
          {
            "value": "unicons",
            "text": "Unicons"
          },
          {
            "value": "clarity-icons",
            "text": "Clarity icons"
          },
          {
            "value": "jam-icons",
            "text": "Jam icons"
          },
          {
            "value": "ant-design-icons",
            "text": "Ant design icons"
          },
          {
            "value": "themify",
            "text": "Themify"
          },
          {
            "value": "css.gg",
            "text": "Css.gg"
          },
          {
            "value": "olicons",
            "text": "Olicons"
          },
          {
            "value": "open-iconic",
            "text": "Open iconic"
          },
          {
            "value": "boxicons",
            "text": "Box icons"
          },
          {
            "value": "elegant-font",
            "text": "Elegant font"
          },
          {
            "value": "dripicons",
            "text": "Dripicons"
          },
          {
            "value": "feather",
            "text": "Feather"
          },
          {
            "value": "coreui-icons",
            "text": "Coreui icons"
          },
          {
            "value": "heroicons",
            "text": "Heroicons"
          },
          {
            "value": "iconoir",
            "text": "Iconoir"
          },
          {
            "value": "iconsax",
            "text": "Iconsax"
          },
          {
            "value": "ikonate",
            "text": "Ikonate"
          },
          {
            "value": "tabler-icons",
            "text": "Tabler icons"
          },
          {
            "value": "octicons",
            "text": "Octicons"
          },
          {
            "value": "system-uicons",
            "text": "System-uicons"
          },
          {
            "value": "font-awesome",
            "text": "FontAwesome"
          },
          {
            "value": "pe-icon-7-stroke",
            "text": "Pixeden icon 7 stroke"
          },
          {
            "value": "77_essential_icons",
            "text": "77 essential icons"
          },
          {
            "value": "150-outlined-icons",
            "text": "150 outlined icons"
          },
          {
            "value": "material-design",
            "text": "Material Design"
          }
        ]
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "RangeInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "RangeInput"
      },
      {
        "name": "Stroke width",
        "key": "stroke-width",
        "htmlAttr": "stroke-width",
        "inputtype": "RangeInput"
      },
      {
        "name": "Code",
        "key": "code",
        "htmlAttr": "outerHTML",
        "inputtype": "TextareaInput"
      },
      {
        "name": false,
        "key": "svg_style_header",
        "inputtype": "SectionInput"
      },
      {
        "name": "Fill",
        "key": "fill",
        "htmlAttr": "fill",
        "inputtype": "ColorInput"
      },
      {
        "name": "Color",
        "key": "color",
        "htmlAttr": "color",
        "inputtype": "ColorInput"
      },
      {
        "name": "Stroke",
        "key": "Stroke",
        "htmlAttr": "stroke",
        "inputtype": "ColorInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/svg-element",
    "parent": null,
    "name": "Svg element",
    "html": "",
    "nodes": [
      "path",
      "line",
      "polyline",
      "polygon",
      "rect",
      "circle",
      "ellipse",
      "g"
    ],
    "properties": [
      {
        "name": "Fill Color",
        "key": "fill",
        "htmlAttr": "fill",
        "inputtype": "ColorInput"
      },
      {
        "name": "Color",
        "key": "color",
        "htmlAttr": "color",
        "inputtype": "ColorInput"
      },
      {
        "name": "Stroke",
        "key": "Stroke",
        "htmlAttr": "color",
        "inputtype": "ColorInput"
      },
      {
        "name": "Stroke width",
        "key": "stroke-width",
        "htmlAttr": "stroke-width",
        "inputtype": "RangeInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/gallery",
    "parent": null,
    "name": "Gallery",
    "html": "<div class=\"gallery masonry has-shadow\" data-component-gallery  id=\"gallery-RANDOM_ID\">\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/1.jpg\" data-aos=\"fade-up\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/2.jpg\" data-aos=\"fade-up\" data-aos-delay=\"100\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/3.jpg\" data-aos=\"fade-up\" data-aos-delay=\"200\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/4.jpg\" data-aos=\"fade-up\" data-aos-delay=\"300\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/5.jpg\" data-aos=\"fade-up\" data-aos-delay=\"400\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"item\">\n\t\t\t\t\t<figure>\n\t\t\t\t\t  <img class=\"img-fluid\" src=\"../../media/demo/posts/6.jpg\" data-aos=\"fade-up\" data-aos-delay=\"500\">\n\t\t\t\t\t  <figcaption></figcaption>\n\t\t\t\t\t\t<h3 class=\"title d-none\"></h3>\n\t\t\t\t\t\t<div class=\"description d-none\"></div>\n\t\t\t\t\t</figure>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t",
    "attributes": [
      "data-component-gallery"
    ],
    "properties": [
      {
        "name": false,
        "key": "masonry",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "masonry",
            "text": "Masonry",
            "title": "Masonry",
            "checked": true
          },
          {
            "value": "flex",
            "text": "Flex",
            "title": "Flex"
          },
          {
            "value": "grid",
            "text": "Grid",
            "title": "Grid"
          }
        ],
        "validValues": [
          "masonry",
          "flex",
          "grid"
        ]
      },
      {
        "name": "Fit images",
        "key": "cover",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "cover"
        ]
      },
      {
        "name": "Image shadow",
        "key": "shadow",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "has-shadow"
        ]
      },
      {
        "name": "Equal rows",
        "key": "grid-auto-rows",
        "htmlAttr": "style",
        "inputtype": "ToggleInput"
      },
      {
        "name": "Hover effect",
        "key": "hover-effect",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "hover-effect"
        ]
      },
      {
        "name": "Horizontal gap",
        "key": "column-gap",
        "htmlAttr": "style",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Vertical gap",
        "key": "margin-bottom",
        "htmlAttr": "style",
        "child": ".item",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Images per row masonry",
        "key": "column-count",
        "htmlAttr": "style",
        "inputtype": "RangeInput"
      },
      {
        "name": "Images per row flex",
        "key": "flex-basis",
        "htmlAttr": "style",
        "child": ".item",
        "inputtype": "RangeInput"
      },
      {
        "name": "Images per row grid",
        "key": "grid-template-columns",
        "htmlAttr": "style",
        "inputtype": "RangeInput"
      },
      {
        "name": "Images",
        "key": "images",
        "htmlAttr": "data-images",
        "inputtype": "ListInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": false
  },
  {
    "type": "elements/tab",
    "parent": null,
    "name": "Tab",
    "html": "",
    "classes": [
      "tab-pane"
    ],
    "properties": [
      {
        "name": "Id",
        "key": "id",
        "htmlAttr": "id",
        "inputtype": "TextInput"
      },
      {
        "name": "Class",
        "key": "class",
        "htmlAttr": "class",
        "inputtype": "TextInput"
      },
      {
        "name": "Active",
        "key": "active",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "active"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/tabs",
    "parent": null,
    "name": "Tabs",
    "html": "\n\t<div data-component-tabs id=\"tabs-parentId\">\n\t\t\t<nav>\n\t\t\t  <div class=\"nav nav-tabs\" role=\"tablist\">\n\t\t\t\t<button class=\"nav-link active\" id=\"nav-tab-parentId-1\" data-bs-toggle=\"tab\" data-bs-target=\"#nav-parentId-1\" type=\"button\" role=\"tab\" aria-controls=\"nav-1\" aria-selected=\"true\">Home</button>\n\t\t\t\t<button class=\"nav-link\" id=\"nav-tab-parentId-2\" data-bs-toggle=\"tab\" data-bs-target=\"#nav-parentId-2\" type=\"button\" role=\"tab\" aria-controls=\"nav-2\" aria-selected=\"false\">Profile</button>\n\t\t\t\t<button class=\"nav-link\" id=\"nav-tab-parentId-3\" data-bs-toggle=\"tab\" data-bs-target=\"#nav-parentId-3\" type=\"button\" role=\"tab\" aria-controls=\"nav-3\" aria-selected=\"false\">Contact</button>\t  </div>\n\t\t\t</nav>\n\t\t\t<div class=\"tab-content\">\n\t\t\t  <div class=\"tab-pane p-4 show active\" id=\"nav-parentId-1\" role=\"tabpanel\" aria-labelledby=\"nav-tab-1\" tabindex=\"0\">\n\t\t\t\t<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corporis perferendis rem accusantium ducimus animi nesciunt expedita omnis aut quas molestias!</p>\n\t\t\t  </div>\n\t\t\t  <div class=\"tab-pane p-4\" id=\"nav-parentId-2\" role=\"tabpanel\" aria-labelledby=\"nav-tab-2\" tabindex=\"0\">\n\t\t\t\t<p>Mauris viverra cursus ante laoreet eleifend. Donec vel fringilla ante. Aenean finibus velit id urna vehicula, nec maximus est sollicitudin</p>\n\t\t\t  </div>\n\t\t\t  <div class=\"tab-pane p-4\" id=\"nav-parentId-3\" role=\"tabpanel\" aria-labelledby=\"nav-tab-3\" tabindex=\"0\">\n\t\t\t\t<p>Quisque sagittis non ex eget vestibulum</p>\n\t\t\t  </div>\n\t\t\t</div>\n\t</div>",
    "attributes": [
      "data-component-tabs"
    ],
    "properties": [
      {
        "key": "list",
        "inputtype": "ListInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/accordion",
    "parent": null,
    "name": "Accordeon",
    "html": "<div class=\"accordion\" id=\"accordion-parentId\">\n\t\t  <div class=\"accordion-item\">\n\t\t\t<h2 class=\"accordion-header\" id=\"headingOne-parentId\">\n\t\t\t  <button class=\"accordion-button\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#collapseOne-parentId\" aria-expanded=\"true\" aria-controls=\"collapseOne-parentId\">\n\t\t\t\tAccordion Item #1\n\t\t\t  </button>\n\t\t\t</h2>\n\t\t\t<div id=\"collapseOne-parentId\" class=\"accordion-collapse collapse show\" aria-labelledby=\"headingOne-parentId\" data-bs-parent=\"#accordion-parentId\">\n\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t<p>Mauris viverra cursus ante laoreet eleifend. Donec vel fringilla ante. Aenean finibus velit id urna vehicula, nec maximus est sollicitudin</p>\n\t\t\t  </div>\n\t\t\t</div>\n\t\t  </div>\n\t\t  <div class=\"accordion-item\">\n\t\t\t<h2 class=\"accordion-header\" id=\"headingTwo-parentId\">\n\t\t\t  <button class=\"accordion-button collapsed\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#collapseTwo-parentId\" aria-expanded=\"false\" aria-controls=\"collapseTwo\">\n\t\t\t\tAccordion Item #2\n\t\t\t  </button>\n\t\t\t</h2>\n\t\t\t<div id=\"collapseTwo-parentId\" class=\"accordion-collapse collapse\" aria-labelledby=\"headingTwo-parentId\" data-bs-parent=\"#accordion-parentId\">\n\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t<p>Mauris viverra cursus ante laoreet eleifend. Donec vel fringilla ante. Aenean finibus velit id urna vehicula, nec maximus est sollicitudin</p>\n\t\t\t  </div>\n\t\t\t</div>\n\t\t  </div>\n\t\t  <div class=\"accordion-item\">\n\t\t\t<h2 class=\"accordion-header\" id=\"headingThree-parentId\">\n\t\t\t  <button class=\"accordion-button collapsed\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#collapseThree-parentId\" aria-expanded=\"false\" aria-controls=\"collapseThree\">\n\t\t\t\tAccordion Item #3\n\t\t\t  </button>\n\t\t\t</h2>\n\t\t\t<div id=\"collapseThree-parentId\" class=\"accordion-collapse collapse\" aria-labelledby=\"headingThree-parentId\" data-bs-parent=\"#accordion-parentId\">\n\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t<p>Mauris viverra cursus ante laoreet eleifend. Donec vel fringilla ante. Aenean finibus velit id urna vehicula, nec maximus est sollicitudin</p>\n\t\t\t  </div>\n\t\t\t</div>\n\t\t  </div>\n\t\t</div>",
    "classes": [
      "accordion"
    ],
    "properties": [
      {
        "key": "list",
        "inputtype": "ListInput"
      },
      {
        "name": "Flush",
        "key": "flush",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "accordion-flush"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/flip-box",
    "parent": null,
    "name": "Flip box",
    "html": "<div class=\"flip-box enabled\">\n\t\t  <div class=\"flip-box-inner\">\n\t\t\t<div class=\"flip-box-front\">\n\t\t\t\t  <div class=\"card\">\n\t\t\t\t  <img src=\"../../media/demo/posts/1.jpg\" class=\"card-img-top\" alt=\"Post\">\n\t\t\t\t  <div class=\"card-body\">\n\t\t\t\t\t<h5 class=\"card-title\">Card title</h5>\n\t\t\t\t\t<p class=\"card-text\">Some quick example text to build on the card title and make up the bulk of the card's content.</p>\n\t\t\t\t\t<a href=\"#\" class=\"btn btn-primary\">Go somewhere</a>\n\t\t\t\t  </div>\n\t\t\t\t</div>\t\n\t\t\t</div>\n\t\t\t\n\t\t\t<div class=\"flip-box-back\">\n\t\t\t\t<div class=\"d-flex align-items-center flex-column\">\n\t\t\t\t  <div class=\"flex-shrink-0\">\n\t\t\t\t\t<img src=\"../../media/demo/posts/2.jpg\" class=\"card-img-top\" alt=\"Post\">\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"flex-grow-1 ms-3\">\n\t\t\t\t\t<p>\n\t\t\t\t\t\tThis is some content from a media component. You can replace this with any content and adjust it as needed.\n\t\t\t\t\t</p>\n\t\t\t\t\t\n\t\t\t\t\t<a href=\"#\" class=\"btn btn-primary\">Go somewhere</a>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t  </div>\n\t\t</div>",
    "classes": [
      "flip-box"
    ],
    "properties": [
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "style",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "style",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Enabled",
        "key": "enabled",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "enabled"
        ]
      },
      {
        "name": "Show back",
        "key": "back",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "back"
        ]
      },
      {
        "name": "Vertical",
        "key": "vertical",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "vertical"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/counter",
    "parent": null,
    "name": "Counter",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/testimonial",
    "parent": null,
    "name": "Testimonial",
    "html": "<blockquote cite=\"https://en.wikipedia.org/wiki/Marcus_Aurelius\">\n\t\t\t\t<p>Today I shall be meeting with interference, ingratitude, insolence, disloyalty, ill-will, and selfishness all of them due to the offenders' ignorance of what is good or evil.</p>\n\t\t\t\t<cite class=\"small\">\n\t\t\t\t\t<a href=\"https://en.wikipedia.org/wiki/Marcus_Aurelius\" class=\"text-decoration-none\" target=\"blank\">Marcus Aurelius</a>\n\t\t\t\t</cite>\t\n\t\t\t</blockquote>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/social-icons",
    "parent": null,
    "name": "Social icons",
    "html": "<ul class=\"social-icons list-unstyled\">\n\t\t\t\t<li>\n\t\t\t\t\t<a href=\"https://facebook.com\">\n\t\t\t\t\t\t<i class=\"lab la-facebook-f la-2x\"></i> <span>Facebook</span>\n\t\t\t\t\t</a>\n\t\t\t\t</li>\n\t\t\t\t<li>\n\t\t\t\t\t<a href=\"https://linkedin.com\">\n\t\t\t\t\t\t<i class=\"lab la-linkedin-in la-2x\"></i> <span>Linkedin</span>\n\t\t\t\t\t</a>\n\t\t\t\t</li>\t\t\n\t\t\t\t<li>\n\t\t\t\t\t<a href=\"https://twitter.com\">\n\t\t\t\t\t\t<i class=\"lab la-twitter la-2x\"></i> <span>Twitter</span>\n\t\t\t\t\t</a>\n\t\t\t\t</li>\t\t\t\t\t\n\t\t\t\t<li>\n\t\t\t\t\t<a href=\"https://instagram.com\">\n\t\t\t\t\t\t<i class=\"lab la-instagram la-2x\"></i> <span>Instagram</span>\n\t\t\t\t\t</a>\n\t\t\t\t</li>\t\t\t\t\n\t\t\t\t<li>\n\t\t\t\t\t<a href=\"https://github.com\">\n\t\t\t\t\t\t<i class=\"lab la-github la-2x\"></i> <span>Github</span>\n\t\t\t\t\t</a>\n\t\t\t\t</li>\n\t\t\t</ul>",
    "classes": [
      "social-icons"
    ],
    "properties": [
      {
        "key": "list",
        "inputtype": "ListInput"
      },
      {
        "name": "Inline",
        "key": "list-inline",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "list-inline"
        ]
      },
      {
        "name": "Unstyled",
        "key": "list-unstyled",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "list-unstyled"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/carousel",
    "parent": null,
    "name": "Carousel",
    "html": "\n\t  <div class=\"swiper\" data-slides-per-view=\"3\" data-draggable=\"true\">\n\t\t<div class=\"swiper-wrapper\">\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/1.jpg\" class=\"img-fluid\"><p>Slide 1</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/2.jpg\" class=\"img-fluid\"><p>Slide 2</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/3.jpg\" class=\"img-fluid\"><p>Slide 3</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/4.jpg\" class=\"img-fluid\"><p>Slide 4</p></div>\n\t\t</div>\n\t\t<div class=\"swiper-pagination\"></div>\n\n\t\t<!--\n\t\t<div class=\"swiper-button-prev\"></div>\n\t\t<div class=\"swiper-button-next\"></div>\n\t\t-->\n\t\t\n\t\t<!-- <div class=\"swiper-scrollbar\"></div> -->\n\t  </div>\t\n\t",
    "classes": [
      "swiper"
    ],
    "properties": [
      {
        "name": "Slides",
        "key": "slidesPerView",
        "htmlAttr": "data-slides-per-view",
        "inputtype": "ListInput"
      },
      {
        "name": "Slides per view",
        "key": "slidesPerView",
        "htmlAttr": "data-slides-per-view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space between",
        "key": "spaceBetween",
        "htmlAttr": "data-space-between",
        "inputtype": "NumberInput"
      },
      {
        "name": "Speed",
        "key": "speed",
        "htmlAttr": "data-speed",
        "inputtype": "NumberInput"
      },
      {
        "name": "Delay",
        "key": "delay",
        "htmlAttr": "data-delay",
        "inputtype": "NumberInput"
      },
      {
        "name": "Effect",
        "key": "effect",
        "htmlAttr": "data-effect",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "None"
          },
          {
            "value": "fade",
            "text": "Fade"
          },
          {
            "value": "flip",
            "text": "Flip"
          },
          {
            "value": "cube",
            "text": "Cube"
          },
          {
            "value": "cards",
            "text": "Cards"
          },
          {
            "value": "creative",
            "text": "Creative"
          }
        ]
      },
      {
        "name": false,
        "key": "carousel_options",
        "inputtype": "SectionInput"
      },
      {
        "name": "Simulate touch",
        "key": "simulateTouch",
        "htmlAttr": "data-simulate-touch",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Autoplay",
        "key": "autoplay",
        "htmlAttr": "data-autoplay",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Auto height",
        "key": "autoHeight",
        "htmlAttr": "data-auto-height",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Centered slides",
        "key": "centeredSlides",
        "htmlAttr": "data-centered-slides",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Center insufficient",
        "key": "centerInsufficientSlides",
        "htmlAttr": "data-center-insufficient-slides",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Loop",
        "key": "loop",
        "htmlAttr": "data-loop",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Mouse wheel",
        "key": "mousewheel",
        "htmlAttr": "data-mousewheel",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Pagination",
        "key": "pagination",
        "htmlAttr": "data-pagination",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Rewind",
        "key": "rewind",
        "htmlAttr": "data-rewind",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Scrollbar",
        "key": "scrollbar",
        "htmlAttr": "data-scrollbar",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "direction",
        "key": "direction",
        "htmlAttr": "data-direction",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "horizontal",
            "icon": "la la-arrow-down",
            "title": "Horizontal",
            "checked": true
          },
          {
            "value": "vertical",
            "title": "Vertical",
            "icon": "la la-arrow-right",
            "checked": false
          }
        ]
      },
      {
        "name": false,
        "key": "breakpoint_options",
        "inputtype": "SectionInput"
      },
      {
        "name": "Slides mobile",
        "key": "sm.view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space mobile",
        "key": "sm.space",
        "inputtype": "NumberInput"
      },
      {
        "name": "Slides tablet",
        "key": "md.view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space tablet",
        "key": "md.space",
        "inputtype": "NumberInput"
      },
      {
        "name": "Slides landscape",
        "key": "lg.view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space landscape",
        "key": "lg.space",
        "inputtype": "NumberInput"
      },
      {
        "name": "Slides laptop",
        "key": "xl.view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space laptop",
        "key": "xl.space",
        "inputtype": "NumberInput"
      },
      {
        "name": "Slides desktop",
        "key": "xxl.view",
        "inputtype": "NumberInput"
      },
      {
        "name": "Space desktop",
        "key": "xxl.space",
        "inputtype": "NumberInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": true
  },
  {
    "type": "elements/slider",
    "parent": null,
    "name": "Slider",
    "html": "\n\t  <div class=\"swiper\" data-slides-per-view=\"1\" data-draggable=\"true\" data-navigation='{\"nextEl\": \".swiper-button-next\",\"prevEl\": \".swiper-button-prev\"}'>\n\t\t<div class=\"swiper-wrapper\">\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/1.jpg\" class=\"img-fluid\"><p>Slider 1</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/2.jpg\" class=\"img-fluid\"><p>Slider 2</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/3.jpg\" class=\"img-fluid\"><p>Slider 3</p></div>\n\t\t  <div class=\"swiper-slide\"><img src=\"../../media/demo/posts/4.jpg\" class=\"img-fluid\"><p>Slider 4</p></div>\n\t\t</div>\n\t\t<div class=\"swiper-pagination\"></div>\n\n\t\t<div class=\"swiper-button-prev\"></div>\n\t\t<div class=\"swiper-button-next\"></div>\n\t\t\n\t\t<!-- <div class=\"swiper-scrollbar\"></div> -->\n\t  </div>\t\n\t",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/icon-list",
    "parent": null,
    "name": "Icon list",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/divider",
    "parent": null,
    "name": "Divider",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/separator",
    "parent": null,
    "name": "Separator",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/Image box",
    "parent": null,
    "name": "Image Box",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/Icon box",
    "parent": null,
    "name": "Image Box",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/animated-headline",
    "parent": null,
    "name": "Animated headline",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/price-table",
    "parent": null,
    "name": "Price table",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/price-list",
    "parent": null,
    "name": "Price list",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/reviews",
    "parent": null,
    "name": "Reviews",
    "html": "<i class=\"font-icon la la-star\"></i>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/code",
    "parent": null,
    "name": "Code",
    "html": "<code>print \"Hello world!\"</code>",
    "nodes": [
      "code"
    ],
    "properties": [
      {
        "name": "Text",
        "key": "text",
        "htmlAttr": "innerHTML",
        "inputtype": "TextareaInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/image-compare",
    "parent": null,
    "name": "Image Compare",
    "html": "<div class=\"c-compare\" style=\"--value:50%;\">\n\t  <img class=\"c-compare__left\" src=\"img/color.jpg\" alt=\"\" />\n\t  <img class=\"c-compare__right\" src=\"img/bw.jpg\" alt=\"\" />\n\t</div>",
    "nodes": [
      ".counter"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "elements/rating",
    "parent": null,
    "name": "Rating stars",
    "html": "<div class=\"rating\">\n                <i class=\"la la-star text-warning\"></i>\n                <i class=\"la la-star text-warning\"></i>\n                <i class=\"la la-star text-warning\"></i>\n                <i class=\"la la-star text-warning\"></i>\n                <i class=\"la la-star text-secondary\"></i>\n            </div>",
    "nodes": [
      ".rating"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/container",
    "parent": "_base",
    "name": "Container",
    "html": "<div class=\"container\" style=\"min-height:150px;\"><div class=\"m-5\">Container</div></div>",
    "classes": [
      "container",
      "container-fluid"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "container",
            "text": "Default"
          },
          {
            "value": "container-fluid",
            "text": "Fluid"
          }
        ],
        "validValues": [
          "container",
          "container-fluid"
        ]
      },
      {
        "name": "Background",
        "key": "background",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "bg-primary",
            "text": "Primary"
          },
          {
            "value": "bg-secondary",
            "text": "Secondary"
          },
          {
            "value": "bg-success",
            "text": "Success"
          },
          {
            "value": "bg-danger",
            "text": "Danger"
          },
          {
            "value": "bg-warning",
            "text": "Warning"
          },
          {
            "value": "bg-info",
            "text": "Info"
          },
          {
            "value": "bg-body-secondary",
            "text": "Light"
          },
          {
            "value": "bg-dark",
            "text": "Dark"
          },
          {
            "value": "bg-white",
            "text": "White"
          }
        ],
        "validValues": [
          "bg-primary",
          "bg-secondary",
          "bg-success",
          "bg-danger",
          "bg-warning",
          "bg-info",
          "bg-body-secondary",
          "bg-dark",
          "bg-white"
        ]
      },
      {
        "name": "Background Color",
        "key": "background-color",
        "htmlAttr": "style",
        "inputtype": "ColorInput"
      },
      {
        "name": "Text Color",
        "key": "color",
        "htmlAttr": "style",
        "inputtype": "ColorInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/btn",
    "parent": "html/link",
    "name": "Button",
    "html": "<a class=\"btn btn-primary\">Primary</a>",
    "nodes": null,
    "classes": [
      "btn"
    ],
    "properties": [
      {
        "name": "Background",
        "key": "background",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "btn-default",
            "text": "Default"
          },
          {
            "value": "btn-primary",
            "text": "Primary"
          },
          {
            "value": "btn btn-info",
            "text": "Info"
          },
          {
            "value": "btn-success",
            "text": "Success"
          },
          {
            "value": "btn-warning",
            "text": "Warning"
          },
          {
            "value": "btn-info",
            "text": "Info"
          },
          {
            "value": "btn-light",
            "text": "Light"
          },
          {
            "value": "btn-dark",
            "text": "Dark"
          },
          {
            "value": "btn-outline-primary",
            "text": "Primary outline"
          },
          {
            "value": "btn btn-outline-info",
            "text": "Info outline"
          },
          {
            "value": "btn-outline-success",
            "text": "Success outline"
          },
          {
            "value": "btn-outline-warning",
            "text": "Warning outline"
          },
          {
            "value": "btn-outline-info",
            "text": "Info outline"
          },
          {
            "value": "btn-outline-light",
            "text": "Light outline"
          },
          {
            "value": "btn-outline-dark",
            "text": "Dark outline"
          },
          {
            "value": "btn-link",
            "text": "Link"
          }
        ],
        "validValues": [
          "btn-default",
          "btn-primary",
          "btn-info",
          "btn-success",
          "btn-warning",
          "btn-info",
          "btn-light",
          "btn-dark",
          "btn-outline-primary",
          "btn-outline-info",
          "btn-outline-success",
          "btn-outline-warning",
          "btn-outline-info",
          "btn-outline-light",
          "btn-outline-dark",
          "btn-link"
        ]
      },
      {
        "name": "Size",
        "key": "size",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "btn-lg",
            "text": "Large"
          },
          {
            "value": "btn-sm",
            "text": "Small"
          }
        ],
        "validValues": [
          "btn-lg",
          "btn-sm"
        ]
      },
      {
        "name": "Autofocus",
        "key": "autofocus",
        "htmlAttr": "autofocus",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "disabled"
        ]
      },
      {
        "name": false,
        "key": "link_options",
        "inputtype": "SectionInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/buttongroup",
    "parent": "_base",
    "name": "Button Group",
    "html": "<div class=\"btn-group\" role=\"group\" aria-label=\"Basic example\"><button type=\"button\" class=\"btn btn-secondary\">Left</button><button type=\"button\" class=\"btn btn-secondary\">Middle</button> <button type=\"button\" class=\"btn btn-secondary\">Right</button></div>",
    "classes": [
      "btn-group"
    ],
    "properties": [
      {
        "name": "Size",
        "key": "size",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "btn-group-lg",
            "text": "Large"
          },
          {
            "value": "btn-group-sm",
            "text": "Small"
          }
        ],
        "validValues": [
          "btn-group-lg",
          "btn-group-sm"
        ]
      },
      {
        "name": "Alignment",
        "key": "alignment",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "btn-group",
            "text": "Horizontal"
          },
          {
            "value": "btn-group-vertical",
            "text": "Vertical"
          }
        ],
        "validValues": [
          "btn-group",
          "btn-group-vertical"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/buttontoolbar",
    "parent": "_base",
    "name": "Button Toolbar",
    "html": "<div class=\"btn-toolbar\" role=\"toolbar\" aria-label=\"Toolbar with button groups\">\t\t  <div class=\"btn-group me-2\" role=\"group\" aria-label=\"First group\">\t\t\t<button type=\"button\" class=\"btn btn-secondary\">1</button>\t\t\t<button type=\"button\" class=\"btn btn-secondary\">2</button>\t\t\t<button type=\"button\" class=\"btn btn-secondary\">3</button>\t\t\t<button type=\"button\" class=\"btn btn-secondary\">4</button>\t\t  </div>\t\t  <div class=\"btn-group me-2\" role=\"group\" aria-label=\"Second group\">\t\t\t<button type=\"button\" class=\"btn btn-secondary\">5</button>\t\t\t<button type=\"button\" class=\"btn btn-secondary\">6</button>\t\t\t<button type=\"button\" class=\"btn btn-secondary\">7</button>\t\t  </div>\t\t  <div class=\"btn-group\" role=\"group\" aria-label=\"Third group\">\t\t\t<button type=\"button\" class=\"btn btn-secondary\">8</button>\t\t  </div>\t\t</div>",
    "classes": [
      "btn-toolbar"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/alert",
    "parent": "_base",
    "name": "Alert",
    "html": "<div class=\"alert alert-warning alert-dismissible fade show\" role=\"alert\">\t\t  <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"alert\" aria-label=\"Close\">\t\t\t<!--span aria-hidden=\"true\">&times;</span-->\t\t  </button>\t\t  <strong>Holy guacamole!</strong> You should check in on some of those fields below.\t\t</div>",
    "classes": [
      "alert"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "alert-primary",
            "text": "Default"
          },
          {
            "value": "alert-secondary",
            "text": "Secondary"
          },
          {
            "value": "alert-success",
            "text": "Success"
          },
          {
            "value": "alert-danger",
            "text": "Danger"
          },
          {
            "value": "alert-warning",
            "text": "Warning"
          },
          {
            "value": "alert-info",
            "text": "Info"
          },
          {
            "value": "alert-light",
            "text": "Light"
          },
          {
            "value": "alert-dark",
            "text": "Dark"
          }
        ],
        "validValues": [
          "alert-primary",
          "alert-secondary",
          "alert-success",
          "alert-danger",
          "alert-warning",
          "alert-info",
          "alert-light",
          "alert-dark"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/badge",
    "parent": "_base",
    "name": "Badge",
    "html": "<span class=\"badge bg-primary\">Primary badge</span>",
    "classes": [
      "badge"
    ],
    "properties": [
      {
        "name": "Color",
        "key": "color",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "bg-primary",
            "text": "Primary"
          },
          {
            "value": "bg-secondary",
            "text": "Secondary"
          },
          {
            "value": "bg-success",
            "text": "Success"
          },
          {
            "value": "bg-warning",
            "text": "Warning"
          },
          {
            "value": "bg-danger",
            "text": "Danger"
          },
          {
            "value": "bg-info",
            "text": "Info"
          },
          {
            "value": "bg-body-secondary",
            "text": "Light"
          },
          {
            "value": "bg-dark",
            "text": "Dark"
          }
        ],
        "validValues": [
          "bg-primary",
          "bg-secondary",
          "bg-success",
          "bg-danger",
          "bg-warning",
          "bg-info",
          "bg-body-secondary",
          "bg-dark"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/card",
    "parent": "_base",
    "name": "Card",
    "html": "<div class=\"card\">\t\t  <img class=\"card-img-top bg-body-secondary\" src=\"/icons/image.svg\" alt=\"Card image cap\">\t\t  <div class=\"card-body\">\t\t\t<h4 class=\"card-title\">Card title</h4>\t\t\t<p class=\"card-text\">Some quick example text to build on the card title and make up the bulk of the card's content.</p>\t\t\t<a href=\"#\" class=\"btn btn-primary\">Go somewhere</a>\t\t  </div>\t\t</div>",
    "classes": [
      "card"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/listgroup",
    "parent": "_base",
    "name": "List Group",
    "html": "<ul class=\"list-group\">\n  <li class=\"list-group-item\">\n    <span class=\"badge bg-success\">14</span>\n    Cras justo odio\n  </li>\n  <li class=\"list-group-item\">\n    <span class=\"badge bg-primary\">2</span>\n    Dapibus ac facilisis in\n  </li>\n  <li class=\"list-group-item\">\n    <span class=\"badge bg-danger\">1</span>\n    Morbi leo risus\n  </li>\n</ul>",
    "classes": [
      "list-group"
    ],
    "properties": [
      {
        "name": "Flush",
        "key": "flush",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "list-group-flush"
        ]
      },
      {
        "name": "Numbered",
        "key": "numbered",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "list-group-numbered"
        ]
      },
      {
        "name": "Horizontal",
        "key": "horizontal",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "list-group-horizontal"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/listitem",
    "parent": "_base",
    "name": "List Item",
    "html": "<li class=\"list-group-item\"><span class=\"badge bg-primary\">14</span> Cras justo odio</li>",
    "classes": [
      "list-group-item"
    ],
    "properties": [
      {
        "name": "Background",
        "key": "background",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "list-group-item-primary",
            "text": "Primary"
          },
          {
            "value": "list-group-item-secondary",
            "text": "Secondary"
          },
          {
            "value": "list-group-item-success",
            "text": "Success"
          },
          {
            "value": "list-group-item-warning",
            "text": "Warning"
          },
          {
            "value": "list-group-item-danger",
            "text": "Danger"
          },
          {
            "value": "list-group-item-info",
            "text": "Info"
          },
          {
            "value": "list-group-item-light",
            "text": "Light"
          },
          {
            "value": "list-group-item-dark",
            "text": "Dark"
          }
        ],
        "validValues": [
          "list-group-item-primary",
          "list-group-item-secondary",
          "list-group-item-success",
          "list-group-item-danger",
          "list-group-item-warning",
          "list-group-item-info",
          "list-group-item-light",
          "list-group-item-dark"
        ]
      },
      {
        "name": "Active",
        "key": "active",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "active"
        ]
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "disabled"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/breadcrumbs",
    "parent": "_base",
    "name": "Breadcrumbs",
    "html": "<ol class=\"breadcrumb\">\n\t\t\t<li class=\"breadcrumb-item\"><a href=\"#\">Home</a></li>\n\t\t\t<li class=\"breadcrumb-item\"><a href=\"#\">Library</a></li>\n\t\t\ts<li class=\"breadcrumb-item active\" aria-current=\"page\"><a href=\"#\">Book</a></li>\n\t\t  </ol>",
    "classes": [
      "breadcrumb"
    ],
    "properties": [
      {
        "name": "Divider",
        "key": "--bs-breadcrumb-divider",
        "htmlAttr": "style",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/breadcrumbitem",
    "parent": "_base",
    "name": "Breadcrumb Item",
    "html": "<li class=\"breadcrumb-item\"><a href=\"#\">Library</a></li>",
    "classes": [
      "breadcrumb-item"
    ],
    "properties": [
      {
        "name": "Active",
        "key": "active",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "active"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/pagination",
    "parent": "_base",
    "name": "Pagination",
    "html": "<nav aria-label=\"Page navigation example\">\t  <ul class=\"pagination\">\t\t<li class=\"page-item\"><a class=\"page-link\" href=\"#\">Previous</a></li>\t\t<li class=\"page-item\"><a class=\"page-link\" href=\"#\">1</a></li>\t\t<li class=\"page-item\"><a class=\"page-link\" href=\"#\">2</a></li>\t\t<li class=\"page-item\"><a class=\"page-link\" href=\"#\">3</a></li>\t\t<li class=\"page-item\"><a class=\"page-link\" href=\"#\">Next</a></li>\t  </ul>\t</nav>",
    "classes": [
      "pagination"
    ],
    "properties": [
      {
        "name": "Size",
        "key": "size",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "pagination-lg",
            "text": "Large"
          },
          {
            "value": "pagination-sm",
            "text": "Small"
          }
        ],
        "validValues": [
          "pagination-lg",
          "pagination-sm"
        ]
      },
      {
        "name": "Alignment",
        "key": "alignment",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "justify-content-center",
            "text": "Center"
          },
          {
            "value": "justify-content-end",
            "text": "Right"
          }
        ],
        "validValues": [
          "justify-content-center",
          "justify-content-end"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/pageitem",
    "parent": "_base",
    "name": "Pagination Item",
    "html": "<li class=\"page-item\"><a class=\"page-link\" href=\"#\">1</a></li>",
    "classes": [
      "page-item"
    ],
    "properties": [
      {
        "name": "Link To",
        "key": "href",
        "htmlAttr": "href",
        "child": ".page-link",
        "inputtype": "LinkInput"
      },
      {
        "name": "Active",
        "key": "active",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "active"
        ]
      },
      {
        "name": "Disabled",
        "key": "disabled",
        "htmlAttr": "class",
        "inputtype": "ToggleInput",
        "validValues": [
          "disabled"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/progress",
    "parent": "_base",
    "name": "Progress Bar",
    "html": "<div class=\"progress\"><div class=\"progress-bar w-25\"></div></div>",
    "classes": [
      "progress"
    ],
    "properties": [
      {
        "name": "Background",
        "key": "background",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "bg-primary",
            "text": "Primary"
          },
          {
            "value": "bg-secondary",
            "text": "Secondary"
          },
          {
            "value": "bg-success",
            "text": "Success"
          },
          {
            "value": "bg-danger",
            "text": "Danger"
          },
          {
            "value": "bg-warning",
            "text": "Warning"
          },
          {
            "value": "bg-info",
            "text": "Info"
          },
          {
            "value": "bg-body-secondary",
            "text": "Light"
          },
          {
            "value": "bg-dark",
            "text": "Dark"
          },
          {
            "value": "bg-white",
            "text": "White"
          }
        ],
        "validValues": [
          "bg-primary",
          "bg-secondary",
          "bg-success",
          "bg-danger",
          "bg-warning",
          "bg-info",
          "bg-body-secondary",
          "bg-dark",
          "bg-white"
        ]
      },
      {
        "name": "Progress",
        "key": "background",
        "htmlAttr": "class",
        "child": ".progress-bar",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "None"
          },
          {
            "value": "w-25",
            "text": "25%"
          },
          {
            "value": "w-50",
            "text": "50%"
          },
          {
            "value": "w-75",
            "text": "75%"
          },
          {
            "value": "w-100",
            "text": "100%"
          }
        ],
        "validValues": [
          "",
          "w-25",
          "w-50",
          "w-75",
          "w-100"
        ]
      },
      {
        "name": "Progress background",
        "key": "background",
        "htmlAttr": "class",
        "child": ".progress-bar",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "bg-primary",
            "text": "Primary"
          },
          {
            "value": "bg-secondary",
            "text": "Secondary"
          },
          {
            "value": "bg-success",
            "text": "Success"
          },
          {
            "value": "bg-danger",
            "text": "Danger"
          },
          {
            "value": "bg-warning",
            "text": "Warning"
          },
          {
            "value": "bg-info",
            "text": "Info"
          },
          {
            "value": "bg-body-secondary",
            "text": "Light"
          },
          {
            "value": "bg-dark",
            "text": "Dark"
          },
          {
            "value": "bg-white",
            "text": "White"
          }
        ],
        "validValues": [
          "bg-primary",
          "bg-secondary",
          "bg-success",
          "bg-danger",
          "bg-warning",
          "bg-info",
          "bg-body-secondary",
          "bg-dark",
          "bg-white"
        ]
      },
      {
        "name": "Striped",
        "key": "striped",
        "htmlAttr": "class",
        "child": ".progress-bar",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "progress-bar-striped"
        ]
      },
      {
        "name": "Animated",
        "key": "animated",
        "htmlAttr": "class",
        "child": ".progress-bar",
        "inputtype": "ToggleInput",
        "validValues": [
          "",
          "progress-bar-animated"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/navbar",
    "parent": "_base",
    "name": "Nav Bar",
    "html": "<nav class=\"navbar navbar-expand-lg bg-body-secondary bg-body-tertiary\">\n\t\t\t  <div class=\"container-fluid\">\n\t\t\t\t<a class=\"navbar-brand\" href=\"#\">Navbar</a>\n\t\t\t\t<button class=\"navbar-toggler\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#navbarTogglerDemo02\" aria-controls=\"navbarTogglerDemo02\" aria-expanded=\"false\" aria-label=\"Toggle navigation\">\n\t\t\t\t  <span class=\"navbar-toggler-icon\"></span>\n\t\t\t\t</button>\n\t\t\t\t<div class=\"collapse navbar-collapse\" id=\"navbarTogglerDemo02\">\n\t\t\t\t  <ul class=\"navbar-nav me-auto mb-2 mb-lg-0\">\n\t\t\t\t\t<li class=\"nav-item\">\n\t\t\t\t\t  <a class=\"nav-link active\" aria-current=\"page\" href=\"#\">Home</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li class=\"nav-item\">\n\t\t\t\t\t  <a class=\"nav-link\" href=\"#\">Link</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li class=\"nav-item\">\n\t\t\t\t\t  <a class=\"nav-link disabled\">Disabled</a>\n\t\t\t\t\t</li>\n\t\t\t\t  </ul>\n\t\t\t\t  <form class=\"d-flex\" role=\"search\">\n\t\t\t\t\t<input class=\"form-control me-2\" type=\"search\" placeholder=\"Search\" aria-label=\"Search\">\n\t\t\t\t\t<button class=\"btn btn-outline-success\" type=\"submit\">Search</button>\n\t\t\t\t  </form>\n\t\t\t\t</div>\n\t\t\t  </div>\n\t\t\t</nav>",
    "classes": [
      "navbar"
    ],
    "properties": [
      {
        "name": "Color theme",
        "key": "color",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "navbar-light",
            "text": "Light"
          },
          {
            "value": "navbar-dark",
            "text": "Dark"
          }
        ],
        "validValues": [
          "navbar-light",
          "navbar-dark"
        ]
      },
      {
        "name": "Background color",
        "key": "background",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "Default",
            "text": ""
          },
          {
            "value": "bg-primary",
            "text": "Primary"
          },
          {
            "value": "bg-secondary",
            "text": "Secondary"
          },
          {
            "value": "bg-success",
            "text": "Success"
          },
          {
            "value": "bg-danger",
            "text": "Danger"
          },
          {
            "value": "bg-warning",
            "text": "Warning"
          },
          {
            "value": "bg-info",
            "text": "Info"
          },
          {
            "value": "bg-body-secondary",
            "text": "Light"
          },
          {
            "value": "bg-dark",
            "text": "Dark"
          },
          {
            "value": "bg-white",
            "text": "White"
          }
        ],
        "validValues": [
          "bg-primary",
          "bg-secondary",
          "bg-success",
          "bg-danger",
          "bg-warning",
          "bg-info",
          "bg-body-secondary",
          "bg-dark",
          "bg-white"
        ]
      },
      {
        "name": "Placement",
        "key": "placement",
        "htmlAttr": "class",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "",
            "text": "Default"
          },
          {
            "value": "fixed-top",
            "text": "Fixed Top"
          },
          {
            "value": "fixed-bottom",
            "text": "Fixed Bottom"
          },
          {
            "value": "sticky-top",
            "text": "Sticky top"
          }
        ],
        "validValues": [
          "fixed-top",
          "fixed-bottom",
          "sticky-top"
        ]
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/gridcolumn",
    "parent": "_base",
    "name": "Grid Column",
    "html": "<div class=\"col-sm-4\"><h3>col-sm-4</h3></div>",
    "classes": [
      "col"
    ],
    "classesRegex": [
      "col-"
    ],
    "properties": [
      {
        "name": "Column",
        "key": "column",
        "inputtype": "GridInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "html/gridrow",
    "parent": "_base",
    "name": "Grid Row",
    "html": "<div class=\"row\"><div class=\"col-sm-4\"><h3>col-sm-4</h3></div><div class=\"col-sm-4 col-5\"><h3>col-sm-4</h3></div><div class=\"col-sm-4\"><h3>col-sm-4</h3></div></div>",
    "classes": [
      "row"
    ],
    "properties": [
      {
        "name": "Direction",
        "key": "direction",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "Default",
            "checked": true
          },
          {
            "value": "flex-row",
            "title": "Row - horizontal",
            "icon": "la la-arrow-right",
            "checked": false
          },
          {
            "value": "flex-column",
            "title": "Column - vertical",
            "icon": "la la-arrow-down",
            "checked": false
          },
          {
            "value": "flex-row-reverse",
            "title": "Row - reversed",
            "icon": "la la-arrow-left",
            "checked": false
          },
          {
            "value": "flex-column-reverse",
            "title": "Column - reversed",
            "icon": "la la-arrow-up",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "flex-row",
          "flex-row-reverse",
          "flex-column",
          "flex-column-reverse"
        ]
      },
      {
        "name": "Vertical align",
        "key": "vertical-align",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "align-items-start",
            "title": "Start",
            "icon": "la la-align-left",
            "checked": false
          },
          {
            "value": "align-items-center",
            "title": "Center",
            "icon": "la la-align-center",
            "checked": false
          },
          {
            "value": "align-items-end",
            "title": "End",
            "icon": "la la-align-right",
            "checked": false
          },
          {
            "value": "align-items-baseline",
            "title": "Baseline",
            "icon": "la la-indent",
            "checked": false
          },
          {
            "value": "align-items-stretch",
            "title": "Stretch",
            "icon": "la la-align-justify",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "align-items-start",
          "align-items-center",
          "align-items-end",
          "align-items-baseline",
          "align-items-stretch"
        ]
      },
      {
        "name": "Horizontal align",
        "key": "horizontal-align",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "justify-content-start",
            "title": "Start",
            "icon": "la la-align-left",
            "checked": false
          },
          {
            "value": "justify-content-center",
            "title": "Center",
            "icon": "la la-align-center",
            "checked": false
          },
          {
            "value": "justify-content-end",
            "title": "End",
            "icon": "la la-align-right",
            "checked": false
          },
          {
            "value": "justify-content-around",
            "title": "Around",
            "icon": "la la-indent",
            "checked": false
          },
          {
            "value": "justify-content-between",
            "title": "Between",
            "icon": "la la-outdent",
            "checked": false
          },
          {
            "value": "justify-content-evenly",
            "title": "Evenly",
            "icon": "la la-align-justify",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "justify-content-start",
          "justify-content-center",
          "justify-content-end",
          "justify-content-around",
          "justify-content-between",
          "justify-content-evenly"
        ]
      },
      {
        "name": "Wrap",
        "key": "wrap",
        "htmlAttr": "class",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "",
            "icon": "la la-times",
            "title": "None",
            "checked": true
          },
          {
            "value": "flex-wrap",
            "title": "Wrap",
            "icon": "la la-undo",
            "checked": false
          },
          {
            "value": "flex-nowrap",
            "title": "No wrap",
            "icon": "la la-arrow-right",
            "checked": false
          }
        ],
        "validValues": [
          "",
          "flex-wrap",
          "flex-nowrap"
        ]
      },
      {
        "name": "Column",
        "key": "column1",
        "inputtype": "GridInput"
      },
      {
        "name": "Column",
        "key": "column1",
        "inputtype": "GridInput"
      },
      {
        "name": "",
        "key": "addChild",
        "inputtype": "ButtonInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "widgets/googlemaps",
    "parent": "_base",
    "name": "Google Maps",
    "html": "<div data-component-maps><iframe frameborder=\"0\" src=\"https://maps.google.com/maps?q=Bucharest&z=15&t=q&key=&output=embed\" width=\"100%\" height=\"100%\" style=\"width:100%;height:100%;left:0px\"></iframe></div>",
    "attributes": [
      "data-component-maps"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Address",
        "key": "q",
        "inputtype": "TextInput"
      },
      {
        "name": "Map type",
        "key": "t",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "q",
            "text": "Roadmap"
          },
          {
            "value": "w",
            "text": "Satellite"
          }
        ]
      },
      {
        "name": "Zoom",
        "key": "z",
        "inputtype": "RangeInput"
      },
      {
        "name": "Key",
        "key": "key",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": true
  },
  {
    "type": "widgets/openstreetmap",
    "parent": "_base",
    "name": "Open Street Map",
    "html": "<div data-component-openstreetmap><iframe width=\"100%\" height=\"100%\" frameborder=\"0\" scrolling=\"no\" marginheight=\"0\" marginwidth=\"0\" src=\"https://www.openstreetmap.org/export/embed.html?bbox=-62.04673002474011%2C16.95487694424327%2C-61.60521696321666%2C17.196751341562923&layer=mapnik\"></iframe></div>",
    "attributes": [
      "data-component-openstreetmap"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Map",
        "key": "bbox",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": true
  },
  {
    "type": "widgets/embed-video",
    "parent": "_base",
    "name": "Embed Video",
    "html": "<div data-component-video style=\"width:640px;height:480px;\" playsinline=\"true\" autoplay=\"true\" mute=\"true\"><iframe frameborder=\"0\" src=\"https://www.youtube.com/embed/C6fOoy7Se_4?autoplay=1&loop=1&playsinline=1&controls=0&mute=1\" width=\"100%\" height=\"100%\"></iframe></div>",
    "attributes": [
      "data-component-video"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Provider",
        "key": "t",
        "inputtype": "SelectInput",
        "options": [
          {
            "text": "Youtube",
            "value": "y"
          },
          {
            "text": "Vimeo",
            "value": "v"
          },
          {
            "text": "HTML5",
            "value": "h"
          }
        ]
      },
      {
        "name": "Video",
        "key": "video_id",
        "inputtype": "TextInput"
      },
      {
        "name": "Poster",
        "key": "poster",
        "htmlAttr": "poster",
        "inputtype": "ImageInput"
      },
      {
        "name": "Url",
        "key": "url",
        "inputtype": "TextInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "style",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "style",
        "inputtype": "CssUnitInput"
      },
      {
        "name": false,
        "key": "video_options",
        "inputtype": "SectionInput"
      },
      {
        "name": "Auto play",
        "key": "autoplay",
        "htmlAttr": "autoplay",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Plays inline",
        "key": "playsinline",
        "htmlAttr": "playsinline",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Controls",
        "key": "controls",
        "htmlAttr": "controls",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Loop",
        "key": "loop",
        "htmlAttr": "loop",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Mute",
        "key": "mute",
        "htmlAttr": "mute",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "",
        "key": "autoplay_warning",
        "inputtype": "NoticeInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": true
  },
  {
    "type": "widgets/facebookcomments",
    "parent": "_base",
    "name": "Facebook Comments",
    "html": "<div  data-component-facebookcomments><script>(function(d, s, id) {\t\t\t  let js, fjs = d.getElementsByTagName(s)[0];\t\t\t  if (d.getElementById(id)) return;\t\t\t  js = d.createElement(s); js.id = id;\t\t\t  js.src = \"//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.6&appId=\";\t\t\t  fjs.parentNode.insertBefore(js, fjs);\t\t\t}(document, 'script', 'facebook-jssdk'));</script>\t\t\t<div class=\"fb-comments\" \t\t\tdata-href=\"\" \t\t\tdata-numposts=\"5\" \t\t\tdata-colorscheme=\"light\" \t\t\tdata-mobile=\"\" \t\t\tdata-order-by=\"social\" \t\t\tdata-width=\"100%\" \t\t\t></div></div>",
    "attributes": [
      "data-component-facebookcomments"
    ],
    "properties": [
      {
        "name": "Href",
        "key": "business",
        "htmlAttr": "data-href",
        "child": ".fb-comments",
        "inputtype": "TextInput"
      },
      {
        "name": "Item name",
        "key": "item_name",
        "htmlAttr": "data-numposts",
        "child": ".fb-comments",
        "inputtype": "TextInput"
      },
      {
        "name": "Color scheme",
        "key": "colorscheme",
        "htmlAttr": "data-colorscheme",
        "child": ".fb-comments",
        "inputtype": "TextInput"
      },
      {
        "name": "Order by",
        "key": "order-by",
        "htmlAttr": "data-order-by",
        "child": ".fb-comments",
        "inputtype": "TextInput"
      },
      {
        "name": "Currency code",
        "key": "width",
        "htmlAttr": "data-width",
        "child": ".fb-comments",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "widgets/twitter",
    "parent": "_base",
    "name": "Twitter",
    "html": "<div data-component-twitter><iframe width=\"100%\" height=\"100%\"src=\"https://platform.twitter.com/embed/Tweet.html?embedId=twitter-widget-0&frame=false&hideCard=false&hideThread=false&id=943901463998169088\"></iframe></div>",
    "attributes": [
      "data-component-twitter"
    ],
    "resizable": true,
    "properties": [
      {
        "name": "Tweet",
        "key": "tweet",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": true,
    "hasOnChange": true
  },
  {
    "type": "widgets/paypal",
    "parent": "_base",
    "name": "Paypal",
    "html": "<form action=\"https://www.paypal.com/cgi-bin/webscr\" method=\"post\" data-component-paypal>\t\t\t\t<!-- Identify your business so that you can collect the payments. -->\t\t\t\t<input type=\"hidden\" name=\"business\"\t\t\t\t\tvalue=\"givanz@yahoo.com\">\t\t\t\t<!-- Specify a Donate button. -->\t\t\t\t<input type=\"hidden\" name=\"cmd\" value=\"_donations\">\t\t\t\t<!-- Specify details about the contribution -->\t\t\t\t<input type=\"hidden\" name=\"item_name\" value=\"VvvebJs\">\t\t\t\t<input type=\"hidden\" name=\"item_number\" value=\"Support\">\t\t\t\t<input type=\"hidden\" name=\"currency_code\" value=\"USD\">\t\t\t\t<!-- Display the payment button. -->\t\t\t\t<input type=\"image\" name=\"submit\"\t\t\t\tsrc=\"https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif\"\t\t\t\talt=\"Donate\">\t\t\t\t<img alt=\"\" width=\"1\" height=\"1\"\t\t\t\tsrc=\"https://www.paypalobjects.com/en_US/i/scr/pixel.gif\" >\t\t\t</form>",
    "attributes": [
      "data-component-paypal"
    ],
    "properties": [
      {
        "name": "Email",
        "key": "business",
        "htmlAttr": "value",
        "child": "input[name='business']",
        "inputtype": "TextInput"
      },
      {
        "name": "Item name",
        "key": "item_name",
        "htmlAttr": "value",
        "child": "input[name='item_name']",
        "inputtype": "TextInput"
      },
      {
        "name": "Item number",
        "key": "item_number",
        "htmlAttr": "value",
        "child": "input[name='item_number']",
        "inputtype": "TextInput"
      },
      {
        "name": "Currency code",
        "key": "currency_code",
        "htmlAttr": "value",
        "child": "input[name='currency_code']",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "widgets/facebookpage",
    "parent": "_base",
    "name": "Facebook Page Plugin",
    "html": "<div data-component-facebookpage><div class=\"fb-page\" \n\t\t\t data-href=\"https://www.facebook.com/facebook\" \n\t\t\t data-tabs=\"timeline\"\n\t\t\t data-width=\"\" \n\t\t\t data-height=\"\" \n\t\t\t data-small-header=\"true\" \n\t\t\t data-adapt-container-width=\"true\" \n\t\t\t data-hide-cover=\"false\" \n\t\t\t data-show-facepile=\"true\">\n\t\t\t \n\t\t\t\t<blockquote cite=\"https://www.facebook.com/facebook\" class=\"fb-xfbml-parse-ignore\">\n\t\t\t\t\t<a href=\"https://www.facebook.com/facebook\">Facebook</a>\n\t\t\t\t</blockquote>\n\n\t\t\t</div>\n\n\t\t\t<div id=\"fb-root\"></div>\n\t\t\t<script async defer crossorigin=\"anonymous\" src=\"https://connect.facebook.net/ro_RO/sdk.js#xfbml=1&version=v15.0\" nonce=\"o7Y7zPjy\"></script>\n\t\t</div>",
    "attributes": [
      "data-component-facebookpage"
    ],
    "properties": [
      {
        "name": "Small header",
        "key": "small-header",
        "htmlAttr": "data-small-header",
        "child": ".fb-page",
        "inputtype": "TextInput"
      },
      {
        "name": "Adapt container width",
        "key": "adapt-container-width",
        "htmlAttr": "data-adapt-container-width",
        "child": ".fb-page",
        "inputtype": "TextInput"
      },
      {
        "name": "Hide cover",
        "key": "hide-cover",
        "htmlAttr": "data-hide-cover",
        "child": ".fb-page",
        "inputtype": "TextInput"
      },
      {
        "name": "Show facepile",
        "key": "show-facepile",
        "htmlAttr": "data-show-facepile",
        "child": ".fb-page",
        "inputtype": "TextInput"
      },
      {
        "name": "App Id",
        "key": "appid",
        "htmlAttr": "data-appId",
        "child": ".fb-page",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": true
  },
  {
    "type": "widgets/chartjs",
    "parent": "_base",
    "name": "Chart.js",
    "html": "<div data-component-chartjs class=\"chartjs\" data-chart='{\t\t\t\"type\": \"line\",\t\t\t\"data\": {\t\t\t\t\"labels\": [\"Red\", \"Blue\", \"Yellow\", \"Green\", \"Purple\", \"Orange\"],\t\t\t\t\"datasets\": [{\t\t\t\t\t\"data\": [12, 19, 3, 5, 2, 3],\t\t\t\t\t\"fill\": false,\t\t\t\t\t\"borderColor\":\"rgba(255, 99, 132, 0.2)\"\t\t\t\t},{\t\t\t\t\t\"fill\": false,\t\t\t\t\t\"data\": [3, 15, 7, 4, 19, 12],\t\t\t\t\t\"borderColor\": \"rgba(54, 162, 235, 0.2)\"\t\t\t\t}]\t\t\t}}' style=\"min-height:240px;min-width:240px;width:100%;height:100%;position:relative\">\t\t\t  <canvas></canvas>\t\t\t</div>",
    "attributes": [
      "data-component-chartjs"
    ],
    "properties": [
      {
        "name": "Type",
        "key": "type",
        "inputtype": "SelectInput",
        "options": [
          {
            "text": "Line",
            "value": "line"
          },
          {
            "text": "Bar",
            "value": "bar"
          },
          {
            "text": "Pie",
            "value": "pie"
          },
          {
            "text": "Doughnut",
            "value": "doughnut"
          },
          {
            "text": "Polar Area",
            "value": "polarArea"
          },
          {
            "text": "Bubble",
            "value": "bubble"
          },
          {
            "text": "Scatter",
            "value": "scatter"
          },
          {
            "text": "Radar",
            "value": "radar"
          }
        ]
      }
    ],
    "hasInit": true,
    "hasOnChange": false
  },
  {
    "type": "widgets/lottie",
    "parent": null,
    "name": "Lottie",
    "html": "\n\t  <div class=\"lottie\" data-component-lottie data-path=\"https://labs.nearpod.com/bodymovin/demo/markus/isometric/markus2.json\" data-loop=\"true\" data-autoplay=\"true\">\n\t  </div>\t\n\t",
    "attributes": [
      "data-component-lottie"
    ],
    "properties": [
      {
        "name": "Path",
        "key": "path",
        "htmlAttr": "data-path",
        "inputtype": "TextInput"
      },
      {
        "name": "Autoplay",
        "key": "autoplay",
        "htmlAttr": "data-autoplay",
        "inputtype": "CheckboxInput"
      },
      {
        "name": "Loop",
        "key": "loop",
        "htmlAttr": "data-loop",
        "inputtype": "CheckboxInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": true
  },
  {
    "type": "embeds/embed",
    "parent": "_base",
    "name": "Embed",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t<h6>Enter url to embed</h6>\n\t\t\t</div></div>",
    "attributes": [
      "data-component-oembed"
    ],
    "properties": [
      {
        "name": "Url",
        "key": "url",
        "htmlAttr": "data-url",
        "inputtype": "TextInput"
      },
      {
        "name": "Width",
        "key": "width",
        "htmlAttr": "width",
        "child": "iframe",
        "inputtype": "CssUnitInput"
      },
      {
        "name": "Height",
        "key": "height",
        "htmlAttr": "height",
        "child": "iframe",
        "inputtype": "CssUnitInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/youtube",
    "parent": null,
    "name": "youtube",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter youtube url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/vimeo",
    "parent": null,
    "name": "vimeo",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter vimeo url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/dailymotion",
    "parent": null,
    "name": "dailymotion",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter dailymotion url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/flickr",
    "parent": null,
    "name": "flickr",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter flickr url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/smugmug",
    "parent": null,
    "name": "smugmug",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter smugmug url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/scribd",
    "parent": null,
    "name": "scribd",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter scribd url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/twitter",
    "parent": null,
    "name": "twitter",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter twitter url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/soundcloud",
    "parent": null,
    "name": "soundcloud",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter soundcloud url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/slideshare",
    "parent": null,
    "name": "slideshare",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter slideshare url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/spotify",
    "parent": null,
    "name": "spotify",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter spotify url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/imgur",
    "parent": null,
    "name": "imgur",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter imgur url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/issuu",
    "parent": null,
    "name": "issuu",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter issuu url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/mixcloud",
    "parent": null,
    "name": "mixcloud",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter mixcloud url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/ted",
    "parent": null,
    "name": "ted",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter ted url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/animoto",
    "parent": null,
    "name": "animoto",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter animoto url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/tumblr",
    "parent": null,
    "name": "tumblr",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter tumblr url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/kickstarter",
    "parent": null,
    "name": "kickstarter",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter kickstarter url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/reverbnation",
    "parent": null,
    "name": "reverbnation",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter reverbnation url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/reddit",
    "parent": null,
    "name": "reddit",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter reddit url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/speakerdeck",
    "parent": null,
    "name": "speakerdeck",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter speakerdeck url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/screencast",
    "parent": null,
    "name": "screencast",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter screencast url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/amazon",
    "parent": null,
    "name": "amazon",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter amazon url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/someecards",
    "parent": null,
    "name": "someecards",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter someecards url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/tiktok",
    "parent": null,
    "name": "tiktok",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter tiktok url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/pinterest",
    "parent": null,
    "name": "pinterest",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter pinterest url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/wolfram",
    "parent": null,
    "name": "wolfram",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter wolfram url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "embeds/anghami",
    "parent": null,
    "name": "anghami",
    "html": "<div data-component-oembed data-url=\"\">\n\t\t\t\t<div class=\"alert alert-light  m-5\" role=\"alert\">\n\t\t\t\t\t<img width=\"64\" src=\"/icons/code.svg\">\n\t\t\t\t\t<h6>Enter anghami url to embed</h6>\n\t\t\t\t</div></div>",
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/product",
    "parent": null,
    "name": "Product",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_product"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/products",
    "parent": null,
    "name": "Products",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "attributes": [
      "data-component-products"
    ],
    "properties": [
      {
        "name": false,
        "key": "type",
        "htmlAttr": "data-type",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "autocomplete",
            "text": "Autocomplete",
            "title": "Autocomplete",
            "icon": "la la-search",
            "checked": true
          },
          {
            "value": "automatic",
            "icon": "la la-cog",
            "text": "Configuration",
            "title": "Configuration"
          }
        ]
      },
      {
        "name": "Products",
        "key": "products",
        "htmlAttr": "data-products",
        "inputtype": "[function]"
      },
      {
        "name": "Number of products",
        "key": "limit",
        "htmlAttr": "data-limit",
        "inputtype": "NumberInput"
      },
      {
        "name": "Start from page",
        "key": "page",
        "htmlAttr": "data-page",
        "inputtype": "NumberInput"
      },
      {
        "name": "Order by",
        "key": "order",
        "htmlAttr": "data-order",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "price_asc",
            "text": "Price Ascending"
          },
          {
            "value": "price_desc",
            "text": "Price Descending"
          },
          {
            "value": "date_asc",
            "text": "Date Ascending"
          },
          {
            "value": "date_desc",
            "text": "Date Descending"
          },
          {
            "value": "sales_asc",
            "text": "Sales Ascending"
          },
          {
            "value": "sales_desc",
            "text": "Sales Descending"
          }
        ]
      },
      {
        "name": "Category",
        "key": "category",
        "htmlAttr": "data-category",
        "inputtype": "[function]"
      },
      {
        "name": "Manufacturer",
        "key": "manufacturer",
        "htmlAttr": "data-manufacturer",
        "inputtype": "[function]"
      },
      {
        "name": "Manufacturer 2",
        "key": "manufacturer 2",
        "htmlAttr": "data-manufacturer2",
        "inputtype": "[function]"
      }
    ],
    "hasInit": true,
    "hasOnChange": false
  },
  {
    "type": "components/manufacturers",
    "parent": null,
    "name": "Manufacturers",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_manufacturers"
    ],
    "properties": [
      {
        "inputtype": "TextInput"
      },
      {
        "name": "Name",
        "key": "category",
        "inputtype": "TextInput"
      },
      {
        "name": "Image",
        "key": "category",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/categories",
    "parent": null,
    "name": "Categories",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_categories"
    ],
    "properties": [
      {
        "name": "Name",
        "key": "name",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/search",
    "parent": null,
    "name": "Search",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_search"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/user",
    "parent": null,
    "name": "User",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_user"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/product_gallery",
    "parent": null,
    "name": "Product gallery",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_product_gallery"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/cart",
    "parent": null,
    "name": "Cart",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_cart"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/checkout",
    "parent": null,
    "name": "Checkout",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_checkout"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/filters",
    "parent": null,
    "name": "Filters",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "classes": [
      "component_filters"
    ],
    "properties": [
      {
        "name": "asdasdad",
        "key": "src",
        "htmlAttr": "src",
        "inputtype": "FileUploadInput"
      },
      {
        "name": "34234234",
        "key": "width",
        "htmlAttr": "width",
        "inputtype": "TextInput"
      },
      {
        "name": "d32d23",
        "key": "height",
        "htmlAttr": "height",
        "inputtype": "TextInput"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/slide",
    "parent": null,
    "name": "Slide",
    "attributes": [
      "data-slide"
    ],
    "properties": [],
    "hasInit": false,
    "hasOnChange": false
  },
  {
    "type": "components/slider",
    "parent": null,
    "name": "Slider",
    "html": "<div class=\"mb-2\"><label>Your response:</label><textarea class=\"form-control\"></textarea></div>",
    "attributes": [
      "data-component-slider"
    ],
    "properties": [
      {
        "name": false,
        "key": "type",
        "htmlAttr": "data-type",
        "inputtype": "RadioButtonInput",
        "options": [
          {
            "value": "autocomplete",
            "text": "Autocomplete",
            "title": "Autocomplete",
            "icon": "la la-search",
            "checked": true
          },
          {
            "value": "automatic",
            "icon": "la la-cog",
            "text": "Configuration",
            "title": "Configuration"
          }
        ]
      },
      {
        "name": "Products",
        "key": "products",
        "htmlAttr": "data-products",
        "inputtype": "[function]"
      },
      {
        "name": "Number of products",
        "key": "limit",
        "htmlAttr": "data-limit",
        "inputtype": "NumberInput"
      },
      {
        "name": "Start from page",
        "key": "page",
        "htmlAttr": "data-page",
        "inputtype": "NumberInput"
      },
      {
        "name": "Order by",
        "key": "order",
        "htmlAttr": "data-order",
        "inputtype": "SelectInput",
        "options": [
          {
            "value": "price_asc",
            "text": "Price Ascending"
          },
          {
            "value": "price_desc",
            "text": "Price Descending"
          },
          {
            "value": "date_asc",
            "text": "Date Ascending"
          },
          {
            "value": "date_desc",
            "text": "Date Descending"
          },
          {
            "value": "sales_asc",
            "text": "Sales Ascending"
          },
          {
            "value": "sales_desc",
            "text": "Sales Descending"
          }
        ]
      },
      {
        "name": "Category",
        "key": "category",
        "htmlAttr": "data-category",
        "inputtype": "[function]"
      },
      {
        "name": "Manufacturer",
        "key": "manufacturer",
        "htmlAttr": "data-manufacturer",
        "inputtype": "[function]"
      },
      {
        "name": "Manufacturer 2",
        "key": "manufacturer 2",
        "htmlAttr": "data-manufacturer2",
        "inputtype": "[function]"
      }
    ],
    "hasInit": false,
    "hasOnChange": false
  }
] as const;
