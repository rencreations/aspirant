"""The fan comics: 21 Instagram posts of MGL creators. Written from the author's readme.txt of each
post (rewritten plainly) and from the pictures. Every one is marked non-canon on the site.

`code` is the Instagram shortcode (the folder is `instagram_p_<code>`). `chars` lists the Aspirants
who appear. `pair` is set only when every Aspirant in the comic belongs to one pair.

One post is left out on purpose: CZJ3yserjrU (see EXCLUDED).
"""

from __future__ import annotations

FAN: list[dict] = [
    dict(code="ClbT9aULTis", title="The morning routine",
         desc="A day starts for Ruby, Angela, Fanny and Layla. Ruby wakes up, Angela and Layla are already dressed and Fanny sleeps on. They race to the school gate, and the order they arrive in is ranked at the end.",
         chars=["ruby", "angela", "fanny", "layla"], pair=None, tags=["school", "comedy"]),
    dict(code="CY6Irl2lDW7", title="Art class",
         desc="Layla and Fanny draw in art class at Selrick Academy. Layla calls her drawing a masterpiece. Fanny draws Layla perfectly, and Layla's drawing of Fanny looks like a child's.",
         chars=["layla", "fanny"], pair="fanny-layla", tags=["school", "comedy"]),
    dict(code="CYv7JViKV0c", title="Voice actors wanted",
         desc="Fanny runs to Layla with a letter in front of a crowd at the game studio's headquarters. They are hiring voice actors for an animation series, and both cheer.",
         chars=["fanny", "layla"], pair="fanny-layla", tags=["comedy", "parody"]),
    dict(code="CZBpgjvL6zn", title="Do you trust me?",
         desc="At Selrick Academy something has run away again. Fanny asks Layla if she trusts her, then takes Layla on her back and flies. Layla is terrified.",
         chars=["fanny", "layla"], pair="fanny-layla", tags=["school", "comedy"]),
    dict(code="CZEKpJ-LqMe", title="The phone",
         desc="On the battlefield Fanny sits under a sign that says \"Don't touch my purple buff!\" and plays on her phone. Layla passes by singing, spots the phone and tries to take it.",
         chars=["fanny", "layla"], pair="fanny-layla", tags=["battlefield", "comedy"]),
    dict(code="CZEQnQhrnAR", title="Wrong server?",
         desc="A comedy set on the in-game battlefield. Layla and Fanny speak Japanese lines, and other heroes wonder if they joined the wrong server. Then Harley shows up in an Ultraman costume.",
         chars=["layla", "fanny"], pair="fanny-layla", tags=["battlefield", "parody"]),
    dict(code="CZWMNTOrLnK", title="No time to rest",
         desc="On a sunny day at Selrick Academy, Fanny enjoys the clear sky after beating an Ender. Layla says they must not let their guard down. Fanny offers a game and then ramen, and Layla says no to both.",
         chars=["fanny", "layla"], pair="fanny-layla", tags=["school", "comedy"]),
    dict(code="CZYxDM5KiC4", title="The new skins",
         desc="Layla and Fanny show off their new looks. Their friends nod, blush and cheer that they look cute.",
         chars=["layla", "fanny"], pair="fanny-layla", tags=["skins", "comedy"]),
    dict(code="CZ64jKvL9tk", title="Before and after the buff",
         desc="Fanny before she gets the buff: she begs for help. Fanny after she gets it: she promises to carry everyone.",
         chars=["fanny"], pair=None, tags=["battlefield", "comedy"]),
    dict(code="CZmVlcULNo5", title="The cook off",
         desc="Fanny and Layla seem to prepare their gear, but they are in a kitchen and cooking. Each presents a dish, and the two compete over whose is better.",
         chars=["fanny", "layla"], pair="fanny-layla", tags=["comedy"]),
    dict(code="CZoiWngtIKV", title="Valentina and the new skin",
         desc="Valentina is a hero who can copy an enemy hero and its skin. Every time an expensive new skin arrives she says \"Time to shine\" and turns into Layla in her Aspirant skin.",
         chars=["layla"], pair=None, tags=["skins", "parody"]),
    dict(code="CZrK5h0PK9R", title="Layla is kind",
         desc="Fanny narrates. People think Layla is cold and has piercing eyes. The truth is that Layla is a very kind and soft person, and she asks Fanny to help a cat stuck in a tree.",
         chars=["layla", "fanny"], pair="fanny-layla", tags=["school", "comedy"],
         credit_override=dict(by="@anzsketch and @mstrzei",
                              note="The post names two artists. The pages are signed ANZSKETCH.")),
    dict(code="Clx10V7PrSN", title="Somebody, help me!",
         desc="A parody of the in-game battlefield. Fanny runs from an enemy with low health and cries for help. Ruby drops in to protect her, but Angela gives her shield and health to Ruby, who is at full health. Fanny is left crying in the corner.",
         chars=["fanny", "ruby", "angela"], pair=None, tags=["battlefield", "parody"]),
    dict(code="CmBSlYuvunj", title="Who should Angela help?",
         desc="On the battlefield Fanny needs help in the jungle, Ruby is low on health and Layla is about to be ambushed. Angela is confused about whom to help first.",
         chars=["angela", "fanny", "ruby", "layla"], pair=None, tags=["battlefield", "comedy"]),
    dict(code="CmLzf3DOo-7", title="Never mind",
         desc="At Selrick Academy, Ruby walks side by side with Angela. Fanny asks Angela to play, but Ruby glares from behind Angela, and only Fanny sees it. Fanny backs off. Angela is confused, and Ruby acts normal.",
         chars=["ruby", "angela", "fanny"], pair=None, tags=["school", "comedy"]),
    dict(code="CmRD9GJMHET", title="The gacha pull",
         desc="Layla stands next to a player who mains Ruby. The player tries to get a Ruby or an Angela skin from the gacha draw and gets the Angela skin instead. The player is sad.",
         chars=["layla", "ruby", "angela"], pair=None, tags=["skins", "comedy"]),
    dict(code="Cmv2oTapYQI", title="Layla bumps Angela",
         desc="At Selrick Academy, Ruby walks beside Angela. Layla sees it, gets annoyed and bumps her head against Angela's. Ruby glares at Layla when Angela is not looking. Layla leaves crying and tells Fanny, and Angela is left confused.",
         chars=["ruby", "angela", "layla", "fanny"], pair=None, tags=["school", "comedy"]),
    dict(code="DetkX5-CSl9", title="Meanwhile, your marksman",
         desc="You fight an enemy to protect your buff. Fanny holds him off. Meanwhile Obsidia, her teammate in this joke, eats the buff in a funny way.",
         chars=["fanny", "obsidia"], pair=None, tags=["battlefield", "parody"]),
    dict(code="CltA3G_St9X", title="Low battery Angela",
         desc="After a long match, Angela crashes into rocks and says she needs a battery. A friend asks if she is alright. Angela glitches from an overcharge, and her charge climbs to 1337 percent.",
         chars=["angela"], pair=None, tags=["battlefield", "comedy"]),
    dict(code="CmEFHWQMk_2", title="Keep her safe",
         desc="Ruby gives Angela a task: protect Angela at all costs. She hands over a small Angela doll and says she trusts her little doll to keep her safe.",
         chars=["ruby", "angela"], pair="ruby-angela", tags=["comedy"]),
    dict(code="CmOLO7vpS-2", title="Angela overload",
         desc="Angela asks to borrow Ruby's headpiece. Ruby says yes. Angela is so excited that she overloads.",
         chars=["ruby", "angela"], pair="ruby-angela", tags=["comedy"]),
]

# Left out of the library, with the reason (also written to scripts/library/ignored.json).
EXCLUDED = {
    "CZJ3yserjrU": "Sexualised joke about an Aspirant who is a minor in the official profiles (Layla is 16). Not shown.",
}
