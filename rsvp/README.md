# RSVP setup

Guests fill in the RSVP form inside the **Details** sheet of each invitation. Responses land in a
Google Sheet you own. The Sheet's **Summary** tab shows, per event and in total, how many parties
responded, how many are attending or declined, and how many seats to reserve.

Until the web app URL is filled in, the invitations show only the contact numbers, so nothing
breaks before setup.

## One-time setup (about 5 minutes)

1. Create a new Google Sheet at https://sheets.new and name it, for example, `RSVPs`.
2. In the Sheet, open **Extensions > Apps Script**. Delete the sample code in `Code.gs`, paste the
   contents of `rsvp/Code.gs` from this repo, and press **Save**.
3. In the toolbar, choose the function **setup** and press **Run**. Approve the permission prompt
   (it only touches this spreadsheet). This creates the `Responses` and `Summary` tabs.
4. Press **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: `rsvp`
   - Execute as: **Me**
   - Who has access: **Anyone**
   Press **Deploy**, approve once more, and copy the **Web app URL** (it ends in `/exec`).
5. Open `rsvp-config.js` in this repo and paste the URL between the quotes:
   ```js
   window.RSVP_URL = "https://script.google.com/macros/s/.../exec";
   ```
6. Commit and push. The RSVP form appears in both invitations on the next page load.

To check the deployment, open the web app URL in a browser. It should show `{"ok":true,"service":"rsvp"}`.

## Reading the responses

- **Responses** tab: one row per guest party. Columns: Submitted, Updated, Event (`wedding` or
  `christening`), Name, Attending, Companions (count), Companion names, Seats (1 + companions when
  attending, 0 when declining), Phone, Message.
- **Summary** tab: totals per event and overall. "Seats to reserve" is the number of chairs you need.
- A name can reply only once per event. If someone sends a second reply under a name that already
  replied, the form tells them a reply exists and asks them to message you instead, so nobody is
  counted twice. The device that sent the first reply can still change it (the form shows a
  "Change my reply" button there). The hidden Token column is what makes that work; leave it alone.
- If you need to correct a row by hand, just edit it in the Sheet. The Summary updates itself.

## Changing the script later

After editing `Code.gs`, use **Deploy > Manage deployments**, press the pencil icon, set Version to
**New version**, and press **Deploy**. The URL stays the same.
