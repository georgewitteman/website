import { decodeQuotedPrintable } from "./quoted-printable.js";

describe("decodeQuotedPrintable", () => {
    it("should convert an encoded string to a normal string", () => {
        const input = `<html xmlns:v=3D"urn:schemas-microsoft-com:vml">
<head>
<meta name=3D"viewport" content=3D"width=3Ddevice-width, initial-scale=3D1.=
0">
<meta http-equiv=3D"Content-Type" content=3D"text/html; charset=3Dutf-8" />
<style  type=3D"text/css" >
td.device-width{width:25%;}
td.content-width{width: 50%;min-width: 300px;}
.ReadMsgBody {width: 100%;}
.ExternalClass {width: 100%;}
span.yshortcuts { color:#333366; background-color:none; border:none;}
span.yshortcuts:hover,
span.yshortcuts:active,
span.yshortcuts:focus {color:#333366; background-color:none; border:none;}
</style></head>
<body style=3D"padding:0;margin:0;min-width:100%;max-width:100%;">
<table width=3D"100%">
      <a border=3D'0' href=3D"https://www.usps.com/?utm_source=3Ddelivered&=
utm_medium=3Demail&utm_content=3Deagle-logo&utm_campaign=3Dtrackingnotify">
      <img style=3D"min-width: 0;" src=3D"https://www.usps.com/email-templa=
te/tracking/tracking-email-logo.png" alt=3D"USPS Logo" />`;
        const expected = `<html xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<style  type="text/css" >
td.device-width{width:25%;}
td.content-width{width: 50%;min-width: 300px;}
.ReadMsgBody {width: 100%;}
.ExternalClass {width: 100%;}
span.yshortcuts { color:#333366; background-color:none; border:none;}
span.yshortcuts:hover,
span.yshortcuts:active,
span.yshortcuts:focus {color:#333366; background-color:none; border:none;}
</style></head>
<body style="padding:0;margin:0;min-width:100%;max-width:100%;">
<table width="100%">
      <a border='0' href="https://www.usps.com/?utm_source=delivered&utm_medium=email&utm_content=eagle-logo&utm_campaign=trackingnotify">
      <img style="min-width: 0;" src="https://www.usps.com/email-template/tracking/tracking-email-logo.png" alt="USPS Logo" />`
        expect(decodeQuotedPrintable(input)).toEqual(expected);
    })
})
