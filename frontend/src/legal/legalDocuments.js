// AUTO-STRUCTURED canonical DRUNK PIGEONS public legal content (verbatim from the
// approved DRUNK_PIGEONS_Legal_Compliance_Pack_v2.0.docx). Do NOT rewrite the legal
// wording. Only the six PUBLIC documents are included here; internal documents
// (05-09, 11, 13-15) are deliberately excluded and must never be bundled.
export const COMPANY = {
  name: 'INTIES LTD.',
  companyNumber: '17433193',
  jurisdiction: 'England and Wales',
  office: '128 City Road, London, EC1V 2NX, United Kingdom',
  email: 'gordon@intiesltd.com',
};

export const SUPPORT_URL = 'https://intiesltd.com/drunk-pigeons/support';

export const LEGAL_DOCUMENTS = [
  {
    "id": "privacy",
    "docNumber": "01",
    "title": "Privacy Policy",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/privacy",
    "sections": [
      {
        "type": "callout",
        "title": "Purpose",
        "text": "Explains what personal data DRUNK PIGEONS processes, why, with whom it is shared, how long it is kept, and the choices and rights available to players."
      },
      {
        "type": "callout",
        "title": "PUBLICATION DETAILS",
        "text": "Privacy/support email: gordon@intiesltd.com. Correspondence address: 128 City Road, London, EC1V 2NX, United Kingdom. Controller/publisher: INTIES LTD., company number 17433193, registered in England and Wales."
      },
      {
        "type": "heading",
        "text": "1. Who we are"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS is a mobile arcade game published by INTIES LTD. (\"DRUNK PIGEONS\", \"we\", \"us\" or \"our\"). INTIES LTD. is registered in England and Wales under company number 17433193. Its registered office is 128 City Road, London, EC1V 2NX, United Kingdom. For UK data-protection law, INTIES LTD. is the controller of the personal data described in this policy."
      },
      {
        "type": "paragraph",
        "text": "Privacy and support contact: gordon@intiesltd.com. Correspondence address: 128 City Road, London, EC1V 2NX, United Kingdom."
      },
      {
        "type": "heading",
        "text": "2. Scope of this policy"
      },
      {
        "type": "paragraph",
        "text": "This policy applies to the DRUNK PIGEONS mobile game, its online leaderboard and associated support/privacy functions. It does not govern Apple, Google or other third-party services that process data under their own terms and privacy notices."
      },
      {
        "type": "heading",
        "text": "3. Privacy at a glance"
      },
      {
        "type": "bullets",
        "items": [
          "You do not need to create a DRUNK PIGEONS account, provide your real name, email address or phone number to play the core game.",
          "The online leaderboard uses an anonymous/random player identifier and a player-chosen nickname. Nicknames are public on the leaderboard; the underlying player identifier is not intended to be public.",
          "We process gameplay/run information to operate the leaderboard and detect cheating or abuse.",
          "IP addresses may be processed transiently for security and rate-limiting, and may also appear in infrastructure/provider logs. We do not use precise GPS location for gameplay.",
          "Advertising is provided through Google AdMob. Depending on your region, consent choices, device settings and ad configuration, Google may process device, advertising, interaction, diagnostic and approximate-location information for ad delivery, measurement, fraud prevention and, where permitted, personalisation.",
          "Payments are handled by Apple App Store or Google Play. We do not receive your full payment-card details.",
          "We do not provide player-to-player chat, direct messaging, photo upload, contacts access or public profiles beyond leaderboard nickname and score."
        ]
      },
      {
        "type": "heading",
        "text": "4. Information we process"
      },
      {
        "type": "table",
        "header": [
          "Category",
          "Examples",
          "Why"
        ],
        "rows": [
          [
            "Anonymous player identifier",
            "A random/local identifier used to distinguish leaderboard players and associate their best score.",
            "Leaderboard operation; abuse prevention."
          ],
          [
            "Leaderboard nickname",
            "The nickname you choose. It is subject to format, profanity and uniqueness rules and is visible publicly with your score.",
            "Leaderboard display and integrity."
          ],
          [
            "Game and run data",
            "Best distance, leaderboard mode, run identifier, run duration, reported distance, revive use, chip/run progression metadata, app/build information and similar validation data.",
            "Leaderboard ranking, game functionality, debugging and anti-cheat."
          ],
          [
            "Security and anti-abuse data",
            "Rate-limit events, rejected/flagged submissions, validation outcomes and, where necessary, network/IP information.",
            "Protecting the service, preventing flooding, fraud, replay submissions and cheating."
          ],
          [
            "Advertising/consent data",
            "Consent status and, depending on Google/OS configuration, device or advertising identifiers, IP-derived information, ad impressions/clicks, diagnostics and related ad-delivery data.",
            "Ad serving, consent management, measurement, fraud prevention and personalisation where lawfully permitted."
          ],
          [
            "Purchase/entitlement data",
            "Store product identifier, transaction/purchase token or receipt information, entitlement state and restoration/verification information. Apple/Google retain the payment-card information.",
            "Delivering, restoring and validating purchases; fraud prevention; support."
          ],
          [
            "Support correspondence",
            "Information you choose to send us when asking for help, a refund issue, privacy request or complaint.",
            "Responding to you and keeping a reasonable support/audit record."
          ],
          [
            "Local game settings",
            "For example sound, Drunkness level, selected pigeon/manor, local unlock flags and preferences stored on your device.",
            "Remembering your settings. This data normally remains on your device unless a feature explicitly transmits it."
          ]
        ]
      },
      {
        "type": "subheading",
        "text": "Information we do not intentionally ask for"
      },
      {
        "type": "paragraph",
        "text": "The game is not designed to collect your real-world identity, precise GPS location, address book, photographs, microphone recordings, health information, biometric information or private messages. If the production build later adds a feature that changes this, this notice and the store privacy disclosures must be updated before that feature is released."
      },
      {
        "type": "heading",
        "text": "5. Why we use information and our lawful bases"
      },
      {
        "type": "table",
        "header": [
          "Purpose",
          "Lawful basis",
          "Data"
        ],
        "rows": [
          [
            "Provide the game and leaderboard",
            "Performance of a contract / steps requested by you; legitimate interests where the feature is free and the processing is necessary to deliver it.",
            "Player ID, nickname, scores, run data."
          ],
          [
            "Protect the leaderboard and backend",
            "Legitimate interests in preventing cheating, flooding, fraud, security incidents and abuse.",
            "Player ID, run data, validation results, IP/security data."
          ],
          [
            "Deliver and restore paid items",
            "Performance of a contract; legitimate interests in preventing purchase fraud; legal obligations where applicable.",
            "Store transaction/entitlement data."
          ],
          [
            "Serve personalised ads or use tracking where consent is legally required",
            "Consent.",
            "Consent choices, advertising/device data as configured."
          ],
          [
            "Serve limited/non-personalised ads where permitted",
            "Consent and/or legitimate interests depending on the technology, jurisdiction and specific processing. We will follow required consent rules and Google platform requirements.",
            "Ad delivery and device/network data."
          ],
          [
            "Respond to support/privacy requests",
            "Legitimate interests, legal obligation, and/or performance of a contract depending on the request.",
            "Support correspondence and relevant identifiers."
          ],
          [
            "Comply with law and enforce legal rights",
            "Legal obligation and legitimate interests.",
            "Relevant records only."
          ]
        ]
      },
      {
        "type": "heading",
        "text": "6. Online leaderboard"
      },
      {
        "type": "paragraph",
        "text": "The leaderboard is designed to work without a DRUNK PIGEONS account. A random player identifier is used behind the scenes, while your chosen nickname and best distance may be shown publicly. Nicknames are globally unique within DRUNK PIGEONS on a case-insensitive/normalised basis, so two different player identifiers cannot intentionally own the same nickname."
      },
      {
        "type": "paragraph",
        "text": "We validate submitted runs for plausibility and abuse. A score may be rejected, delayed, flagged or removed if it is malformed, duplicated, technically implausible, submitted too frequently or otherwise appears to breach the Leaderboard & Fair Play Rules. This does not involve decisions that produce legal or similarly significant effects about you."
      },
      {
        "type": "heading",
        "text": "7. Advertising and privacy choices"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS uses Google AdMob for advertising. The game is designed to use automatic interstitial ads at appropriate game-over transitions and an optional rewarded ad if a player voluntarily chooses to watch an ad for a revive. A paid Remove Ads entitlement removes automatic/forced interstitial advertising but does not remove optional rewarded revive ads that the player chooses to request."
      },
      {
        "type": "paragraph",
        "text": "The game may also display in-game \"sponsored billboard\" artwork as part of the scrolling scenery. This artwork is chosen only from a fixed list of internally approved campaigns and DRUNK PIGEONS house adverts that are bundled with the app. Sponsored billboards are NOT personalised: they are never selected using your behaviour, profile or any personal information, we do not track individual players across campaigns, and we do not add advertising identifiers or additional device tracking for this feature. Where display measurement is used at all, we record only anonymous, aggregate totals per campaign. Players who have purchased Remove Ads are shown only DRUNK PIGEONS house artwork in these billboards."
      },
      {
        "type": "paragraph",
        "text": "For users in the UK, EEA, Switzerland and other regions where consent is required, the production app must use an appropriate Google-certified consent mechanism (such as Google User Messaging Platform) before requesting ads that require consent. A privacy-options entry point will be provided where required so consent choices can be revisited."
      },
      {
        "type": "paragraph",
        "text": "On iOS, if the app or an advertising partner seeks permission to track you across apps or websites owned by other companies, Apple's AppTrackingTransparency permission will be used. If you decline, the app must respect that choice and may not use an alternative identifier to bypass it."
      },
      {
        "type": "paragraph",
        "text": "The exact data Google processes can depend on your region, consent, device settings and the final AdMob configuration. Before release, we will reconcile this policy, Apple App Privacy information and Google Play Data Safety answers against the final SDK/privacy report and production settings."
      },
      {
        "type": "heading",
        "text": "8. In-app purchases"
      },
      {
        "type": "paragraph",
        "text": "In-app purchases are processed through Apple App Store or Google Play. We do not directly receive your full debit/credit-card number. We may receive a transaction identifier, product identifier, purchase token/receipt, entitlement status and related information needed to confirm, restore or support the purchase. The production build is intended to verify paid entitlements using Apple/Google transaction information rather than trusting only a local device flag."
      },
      {
        "type": "heading",
        "text": "9. Sharing and processors"
      },
      {
        "type": "paragraph",
        "text": "We do not sell a DRUNK PIGEONS player list. We share or permit processing of data only where needed for the game, stores, ads, infrastructure, support, security or legal obligations. Current/planned categories include:"
      },
      {
        "type": "bullets",
        "items": [
          "Apple, for iOS distribution, App Store purchases, receipt/transaction services and platform privacy/security functions.",
          "Google, for Google Play distribution and purchases, and Google AdMob/User Messaging Platform for advertising and consent management.",
          "Our production hosting/database/network providers, to host the leaderboard/backend and protect the service. The final production provider must be inserted into the processor register before release.",
          "Professional advisers, regulators, courts or law-enforcement authorities where disclosure is required or reasonably necessary under applicable law.",
          "A lawful successor or purchaser of the publishing business, where necessary for a reorganisation, sale or transfer. We will update this notice where the controller identity changes."
        ]
      },
      {
        "type": "heading",
        "text": "10. International transfers"
      },
      {
        "type": "paragraph",
        "text": "Some service providers, including Apple and Google, operate internationally. Personal data may therefore be processed outside the UK. Where UK data-protection law requires safeguards for a restricted transfer, we will rely on an applicable adequacy regulation, approved contractual safeguards/addendum, or another lawful transfer mechanism, and carry out appropriate due diligence."
      },
      {
        "type": "heading",
        "text": "11. How long we keep information"
      },
      {
        "type": "paragraph",
        "text": "We keep personal data only for as long as reasonably necessary for the purposes described above, subject to legal, security and accounting requirements. The current operational schedule is summarised below and set out in more detail in Document 05."
      },
      {
        "type": "table",
        "header": [
          "Data",
          "Current retention approach"
        ],
        "rows": [
          [
            "Transient run submissions",
            "7 days after creation, via database TTL, unless needed in a separate flagged/security record."
          ],
          [
            "Flagged anti-cheat/abuse submissions",
            "30 days after creation, via database TTL, unless a specific incident requires longer evidence retention."
          ],
          [
            "Leaderboard player record (player ID, nickname, best scores)",
            "While the leaderboard service remains active, unless deletion is requested or the record is no longer necessary; reviewed for necessity at least annually."
          ],
          [
            "IP/rate-limit data",
            "Processed transiently for rate-limiting; not intentionally stored in the leaderboard player database. Infrastructure logs may have separate provider retention, to be confirmed before release."
          ],
          [
            "Purchase/entitlement records",
            "For as long as needed to provide/restorably verify the entitlement and, where necessary, for fraud, accounting or legal records."
          ],
          [
            "Support/privacy correspondence",
            "Normally up to 24 months after resolution, longer only if reasonably required for a dispute or legal obligation."
          ],
          [
            "Backups",
            "Deleted data may remain in protected backups for a limited rotation period (target maximum 90 days) before being overwritten, unless law requires preservation."
          ]
        ]
      },
      {
        "type": "heading",
        "text": "12. Security"
      },
      {
        "type": "paragraph",
        "text": "We use proportionate technical and organisational measures for a small mobile game, including server-side validation, rate limiting, strict identifier validation, duplicate-run protection, database uniqueness controls for leaderboard nicknames, limited retention of transient run data, restricted secrets/configuration, purchase-verification controls before production paid entitlements are accepted, and security testing before store submission. No system can be guaranteed completely secure."
      },
      {
        "type": "heading",
        "text": "13. Children and younger players"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS is not intended to be marketed as a service for young children. However, a cartoon mobile game may be accessed by people under 18, so our design should use privacy-protective defaults, data minimisation and no unnecessary collection of children's information. We do not provide public chat, direct messages, precise location sharing or photo/profile upload."
      },
      {
        "type": "paragraph",
        "text": "Where advertising consent, profiling or age-related platform rules apply, the production configuration must respect the relevant age/consent requirements and store target-audience declarations. We will not knowingly use personal data of a child for personalised advertising where doing so would be unlawful or inconsistent with applicable platform rules. If we learn that personal data has been collected inappropriately from a child, we will take reasonable steps to delete or restrict it."
      },
      {
        "type": "heading",
        "text": "14. Your privacy rights"
      },
      {
        "type": "paragraph",
        "text": "Depending on where you live and the circumstances, you may have rights to ask for access to personal data, correction, deletion, restriction, objection, portability, and withdrawal of consent. These rights are subject to legal conditions and exemptions."
      },
      {
        "type": "paragraph",
        "text": "Because DRUNK PIGEONS deliberately avoids conventional accounts, we may need your locally held support/player identifier to locate a leaderboard record. We may be unable to identify a record from your real name or email because we do not normally store those details against gameplay data."
      },
      {
        "type": "heading",
        "text": "15. How to request deletion"
      },
      {
        "type": "paragraph",
        "text": "To request deletion of leaderboard or other personal data, contact gordon@intiesltd.com and include the DRUNK PIGEONS Support ID / player identifier shown in the app's Settings or Legal area. Do not send a password or payment-card number."
      },
      {
        "type": "paragraph",
        "text": "Deleting the app or clearing local storage can remove local settings from your device but does not by itself guarantee deletion of an online leaderboard record. A separate deletion request is required for server-held leaderboard data unless an in-app deletion control is provided."
      },
      {
        "type": "heading",
        "text": "16. Consent withdrawal"
      },
      {
        "type": "paragraph",
        "text": "Where processing is based on consent, you can withdraw consent without affecting the lawfulness of processing before withdrawal. Advertising/privacy choices should be accessible through the in-app Privacy Choices control when required. iOS tracking permission can also be managed through Apple device settings."
      },
      {
        "type": "heading",
        "text": "17. Automated checks and anti-cheat"
      },
      {
        "type": "paragraph",
        "text": "The backend uses automated technical rules to check whether a run is valid, duplicated, implausible or abusive. These checks may prevent a score from appearing on the leaderboard. They do not make decisions about employment, credit, healthcare or other matters with legal or similarly significant effects. You can contact support if you believe a legitimate leaderboard score was incorrectly rejected or removed."
      },
      {
        "type": "heading",
        "text": "18. Changes to this policy"
      },
      {
        "type": "paragraph",
        "text": "We may update this policy when the game, suppliers, law or privacy practices change. We will update the date at the top and, where appropriate, provide an in-app notice for material changes. We will not use an update to retroactively justify materially different processing where additional consent is required."
      },
      {
        "type": "heading",
        "text": "19. Contact and complaints"
      },
      {
        "type": "paragraph",
        "text": "Privacy questions or requests: gordon@intiesltd.com. Correspondence: 128 City Road, London, EC1V 2NX, United Kingdom."
      },
      {
        "type": "paragraph",
        "text": "If you are in the UK and are unhappy with how we handle your personal data, you can also complain to the Information Commissioner's Office (ICO). We would appreciate the opportunity to address your concern first, but you are not required to contact us before using your regulatory rights."
      }
    ]
  },
  {
    "id": "terms",
    "docNumber": "02",
    "title": "Terms of Use",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/terms",
    "sections": [
      {
        "type": "callout",
        "title": "Purpose",
        "text": "Sets the rules for downloading, playing and using DRUNK PIGEONS, including the leaderboard, game content, acceptable use, intellectual property, service availability and consumer protections."
      },
      {
        "type": "callout",
        "title": "PUBLICATION DETAILS",
        "text": "Support email: gordon@intiesltd.com. Correspondence address: 128 City Road, London, EC1V 2NX, United Kingdom. Publisher: INTIES LTD., company number 17433193, registered in England and Wales."
      },
      {
        "type": "heading",
        "text": "1. These terms"
      },
      {
        "type": "paragraph",
        "text": "These Terms of Use (\"Terms\") apply when you download, install, access or play DRUNK PIGEONS (the \"Game\"). By using the Game, you agree to these Terms. If you do not agree, do not use the Game."
      },
      {
        "type": "paragraph",
        "text": "The Game is published by INTIES LTD., registered in England and Wales under company number 17433193, with registered office at 128 City Road, London, EC1V 2NX, United Kingdom (\"we\", \"us\" or \"our\"). Store and platform terms from Apple or Google also apply."
      },
      {
        "type": "heading",
        "text": "2. The game"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS is a fictional, comic arcade game in which cartoon pigeons fly through an obstacle course. References to drunkenness, pubs, hiccups, \"Skinny Jab\" and similar jokes are fictional gameplay/comedy elements. The Game does not provide health, medical or alcohol advice, and the generic Skinny Jab is not presented as a real medicine or as affiliated with a pharmaceutical brand."
      },
      {
        "type": "heading",
        "text": "3. Eligibility and younger users"
      },
      {
        "type": "paragraph",
        "text": "You must be legally permitted to use the Game and to make any purchase you initiate. If you are under the age at which you can enter a binding purchase contract in your country, you should use the Game and make purchases only with permission from a parent or legal guardian where required. Store parental controls and family-purchase settings may apply."
      },
      {
        "type": "paragraph",
        "text": "The publisher will complete the Apple/Google age-rating and target-audience declarations based on the final content. The Game should not be marketed as being specifically for young children unless the product and advertising configuration are reviewed for the additional rules that would apply."
      },
      {
        "type": "heading",
        "text": "4. Licence to use the Game"
      },
      {
        "type": "paragraph",
        "text": "Subject to these Terms and the relevant app-store terms, we grant you a personal, limited, non-exclusive, non-transferable and revocable licence to install and use the Game on devices you own or control for personal, non-commercial entertainment."
      },
      {
        "type": "paragraph",
        "text": "You do not acquire ownership of the Game, source code, artwork, characters, music, designs, branding, leaderboard service or other intellectual property by downloading or purchasing an in-game entitlement."
      },
      {
        "type": "heading",
        "text": "5. No DRUNK PIGEONS account"
      },
      {
        "type": "paragraph",
        "text": "The current Game does not require a conventional account with an email address or password. Online leaderboard features use an anonymous/random player identifier and a player-selected nickname. You are responsible for preserving access to your device/store account where needed to restore purchases or identify your leaderboard record."
      },
      {
        "type": "heading",
        "text": "6. Leaderboard nickname"
      },
      {
        "type": "paragraph",
        "text": "If you use the leaderboard, you may choose a nickname subject to the Leaderboard & Fair Play Rules. Nicknames must be permitted by the Game's format and profanity/safety filters and must be globally unique within DRUNK PIGEONS on a case-insensitive/normalised basis. We may reject, reserve, change or remove a nickname where reasonably necessary to address impersonation, illegality, abuse, hate, sexual content, harassment, technical conflicts or platform requirements."
      },
      {
        "type": "heading",
        "text": "7. Fair play and prohibited conduct"
      },
      {
        "type": "paragraph",
        "text": "You may not misuse the Game or leaderboard. In particular, you must not:"
      },
      {
        "type": "bullets",
        "items": [
          "submit fabricated, altered, replayed or manipulated scores or run data;",
          "use bots, scripts, memory editors, modified clients, traffic manipulation or other tools to falsify leaderboard results;",
          "attempt to bypass rate limits, security controls, purchase verification or entitlement checks;",
          "probe, attack, overload, interfere with or gain unauthorised access to the backend, database, other users' records or infrastructure;",
          "use another player's nickname/identifier or attempt to impersonate another person;",
          "use the Game in violation of applicable law or store/platform rules; or",
          "commercially exploit, resell, redistribute or create an unauthorised derivative version of the Game except where law expressly permits otherwise."
        ]
      },
      {
        "type": "paragraph",
        "text": "We may reject scores, remove leaderboard entries, rate-limit access or restrict online features where reasonably necessary to protect fair play, security or service integrity. These measures do not prevent you from using any statutory consumer rights relating to paid digital content."
      },
      {
        "type": "heading",
        "text": "8. Game modes and scoring"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS may offer standard manors/modes, Random selection, Easy Mode and separate leaderboards. Normal/Global and Silly Mode scores may be kept separate. Rules, obstacle patterns, balancing and presentation may evolve through updates, but paid content will not be deliberately rendered unusable or materially misdescribed."
      },
      {
        "type": "heading",
        "text": "9. Purchases"
      },
      {
        "type": "paragraph",
        "text": "The Game may offer one-time, non-consumable purchases such as individual premium pigeons, an unlock-all pigeon bundle, Easy Mode and Remove Ads. Purchases are handled through Apple App Store or Google Play, not by entering card details directly into DRUNK PIGEONS. The store-displayed local price and taxes at checkout prevail over any earlier promotional/reference price."
      },
      {
        "type": "paragraph",
        "text": "Paid features do not provide a competitive leaderboard advantage unless the feature itself defines a separate leaderboard category (for example, Easy Mode using the separate Silly Mode leaderboard). Cosmetic pigeons do not change core physics, hitboxes or scoring capability."
      },
      {
        "type": "heading",
        "text": "10. Remove Ads and rewarded ads"
      },
      {
        "type": "paragraph",
        "text": "If offered, Remove Ads is intended to disable automatic/forced interstitial advertising in the Game. It does not disable an optional rewarded ad that you deliberately choose to watch in exchange for a revive or other explicitly described reward. This distinction is part of the product description and Purchase Terms."
      },
      {
        "type": "heading",
        "text": "11. Purchase restoration"
      },
      {
        "type": "paragraph",
        "text": "Where Apple/Google supports restoration of a non-consumable purchase, the Game will provide a reasonable Restore Purchases mechanism or equivalent entitlement refresh. Restoration depends on the relevant store account and transaction status. Promotional, test or secret unlocks are separate from a paid store entitlement and do not necessarily create a transferable/restorable purchase right."
      },
      {
        "type": "heading",
        "text": "12. Updates and changes"
      },
      {
        "type": "paragraph",
        "text": "We may update the Game to fix bugs, improve security, add or remove free content, rebalance gameplay, update compatibility, comply with law/store policy or improve performance. We will not use these Terms to remove statutory rights or to intentionally deprive you of paid digital content without a lawful basis or appropriate remedy."
      },
      {
        "type": "heading",
        "text": "13. Service availability"
      },
      {
        "type": "paragraph",
        "text": "The core game may be designed to remain playable when the leaderboard or advertising service is unavailable, but online features depend on networks, hosting and third-party services. We do not promise uninterrupted or error-free availability. We may suspend an online feature temporarily for maintenance, security, abuse prevention or technical failures."
      },
      {
        "type": "heading",
        "text": "14. Third-party services"
      },
      {
        "type": "paragraph",
        "text": "Apple, Google, advertising providers and network/hosting suppliers provide services under their own terms and policies. We are not responsible for the independent operation of those third-party services, but we remain responsible for our own legal obligations and for selecting/configuring processors appropriately."
      },
      {
        "type": "heading",
        "text": "15. Intellectual property"
      },
      {
        "type": "paragraph",
        "text": "The Game and its original content, including the DRUNK PIGEONS branding, pigeon character designs, artwork, animations, interface, text, code and sound assets created for the Game, are protected by intellectual-property laws as applicable. Third-party libraries, platform components and advertising/store services remain owned/licensed by their respective rights holders."
      },
      {
        "type": "paragraph",
        "text": "You may share ordinary screenshots or gameplay clips for personal, review, commentary or social-media purposes. This permission does not allow you to redistribute the app, sell its assets, claim ownership of the brand/content, or use our assets to mislead people into thinking you are the publisher."
      },
      {
        "type": "heading",
        "text": "16. Consumer rights and digital content"
      },
      {
        "type": "paragraph",
        "text": "Nothing in these Terms excludes or restricts rights that cannot lawfully be excluded. For UK consumers, digital content must meet statutory standards, including being of satisfactory quality, fit for purpose where applicable and as described. If paid digital content is faulty or not supplied as promised, statutory remedies may apply in addition to the platform's refund/support process."
      },
      {
        "type": "heading",
        "text": "17. Our liability"
      },
      {
        "type": "paragraph",
        "text": "We do not exclude or limit liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or other liability that cannot lawfully be limited. Subject to that, the Game is supplied for personal entertainment and we are not responsible for business losses, loss of profit, loss of business opportunity or other losses that were not reasonably foreseeable when you accepted these Terms."
      },
      {
        "type": "paragraph",
        "text": "Nothing in this section affects your statutory rights in relation to paid digital content."
      },
      {
        "type": "heading",
        "text": "18. Suspension and termination"
      },
      {
        "type": "paragraph",
        "text": "You may stop using the Game at any time by uninstalling it. We may suspend or discontinue online services or remove leaderboard entries where reasonably necessary for security, fair play, legal compliance or service closure. If a decision affects a paid entitlement, we will act consistently with applicable law and the relevant store rules."
      },
      {
        "type": "heading",
        "text": "19. Privacy"
      },
      {
        "type": "paragraph",
        "text": "Our Privacy Policy explains how personal data is handled. It forms part of the information you should read when using online leaderboard, advertising or purchase features."
      },
      {
        "type": "heading",
        "text": "20. Changes to these Terms"
      },
      {
        "type": "paragraph",
        "text": "We may update these Terms to reflect changes to the Game, law or platform rules. Material changes will be communicated reasonably, for example through an updated in-app legal section or store release information. Changes do not retrospectively remove rights already accrued under applicable law."
      },
      {
        "type": "heading",
        "text": "21. Governing law and disputes"
      },
      {
        "type": "paragraph",
        "text": "These Terms are governed by the laws of England and Wales, except that if you are a consumer living elsewhere you may also benefit from mandatory consumer protections of your home jurisdiction. Nothing here deprives a consumer of a right to bring proceedings in a court that applicable consumer law allows."
      },
      {
        "type": "heading",
        "text": "22. Contact"
      },
      {
        "type": "paragraph",
        "text": "Support/legal contact: gordon@intiesltd.com. Correspondence address: 128 City Road, London, EC1V 2NX, United Kingdom."
      }
    ]
  },
  {
    "id": "purchases",
    "docNumber": "03",
    "title": "Purchases, Advertising & Refund Terms",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/purchases",
    "sections": [
      {
        "type": "callout",
        "title": "Purpose",
        "text": "Explains the Game's one-time purchases, ad model, restoration, refund routes, digital-content rights and the exact scope of Remove Ads."
      },
      {
        "type": "callout",
        "title": "Important",
        "text": "The price shown by Apple App Store or Google Play at the moment of purchase is the binding store price. GBP figures below are current product reference prices and may be localised or changed before launch."
      },
      {
        "type": "heading",
        "text": "1. Scope"
      },
      {
        "type": "paragraph",
        "text": "These Purchases, Advertising & Refund Terms are issued by INTIES LTD., company number 17433193, and supplement the DRUNK PIGEONS Terms of Use. They apply to in-app purchases and advertising. If mandatory law or the applicable app store provides stronger consumer rights, those rights prevail."
      },
      {
        "type": "heading",
        "text": "2. Current planned paid products"
      },
      {
        "type": "table",
        "header": [
          "Product",
          "Type",
          "Current reference price",
          "Effect"
        ],
        "rows": [
          [
            "Premium pigeon - individual",
            "One-time non-consumable",
            "Reference UK price £1.99 each",
            "Unlocks the selected premium pigeon for gameplay; cosmetic only."
          ],
          [
            "All premium pigeons bundle",
            "One-time non-consumable",
            "Reference UK price £7.99",
            "Unlocks the current five premium pigeons included in the bundle."
          ],
          [
            "Easy Mode",
            "One-time non-consumable",
            "Reference UK price £14.99",
            "Unlocks Easy Mode; its best distances belong on the separate Silly Mode leaderboard."
          ],
          [
            "Remove Ads",
            "One-time non-consumable",
            "Reference UK price £2.99",
            "Removes automatic/forced interstitial ads. Optional rewarded revive ads remain available by player choice."
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "The production app will use Apple/Google store-provided product information and localised pricing. No product listed above is a subscription, rental or recurring charge unless the Game and these terms are expressly updated in the future."
      },
      {
        "type": "heading",
        "text": "3. Store billing"
      },
      {
        "type": "paragraph",
        "text": "Purchases are made through the Apple App Store or Google Play billing system associated with your device/store account. The store may collect taxes, apply currency conversion, require authentication and provide a transaction receipt. DRUNK PIGEONS does not ask you to type card details directly into the Game."
      },
      {
        "type": "heading",
        "text": "4. Purchase verification and delivery"
      },
      {
        "type": "paragraph",
        "text": "Before production launch, paid entitlements should be verified using Apple/Google transaction or receipt information and, where practical, secure server-side verification. A purchase benefit is granted only after the store reports an appropriate completed/purchased state. Pending, cancelled or failed transactions do not create an entitlement."
      },
      {
        "type": "paragraph",
        "text": "If the store confirms a purchase but the content is not delivered, first use Restore Purchases where appropriate and then contact gordon@intiesltd.com with the store order/transaction information that the store permits you to share. Do not send full card details."
      },
      {
        "type": "heading",
        "text": "5. Restore Purchases"
      },
      {
        "type": "paragraph",
        "text": "Non-consumable purchases are intended to be restorable where supported by Apple/Google and where you are using the store account that made the purchase. The Game will provide a Restore Purchases control or equivalent entitlement refresh. Restoration is not guaranteed for development/test unlocks, secret codes, promotional unlocks or entitlements that were never completed as a real store transaction."
      },
      {
        "type": "heading",
        "text": "6. Advertising model"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS may display:"
      },
      {
        "type": "bullets",
        "items": [
          "Automatic interstitial ads at natural game-over/next-run transitions, approximately according to the Game's configured frequency. They are not intended to interrupt active flight.",
          "Optional rewarded revive ads. A player chooses whether to request the ad; the revive/reward is granted only after the advertising SDK confirms the reward event."
        ]
      },
      {
        "type": "paragraph",
        "text": "Ad availability is not guaranteed. If a rewarded ad fails to load or complete, the Game must not block normal play and does not owe the in-game reward unless the reward condition was satisfied."
      },
      {
        "type": "heading",
        "text": "7. What Remove Ads does and does not do"
      },
      {
        "type": "paragraph",
        "text": "Remove Ads is a permanent non-consumable entitlement for the relevant store account/product, subject to store restoration and availability. It removes automatic/forced interstitial ads from DRUNK PIGEONS."
      },
      {
        "type": "paragraph",
        "text": "Remove Ads does NOT remove the optional rewarded revive option. Because a rewarded revive ad is initiated voluntarily to obtain a specific in-game benefit, the option may continue to appear even when Remove Ads is owned. You can simply choose not to use it."
      },
      {
        "type": "heading",
        "text": "8. Refunds and cancellation rights"
      },
      {
        "type": "paragraph",
        "text": "Refund eligibility is determined by applicable law, the nature of the issue and the relevant store process. Apple and Google provide their own mechanisms for requesting refunds for App Store/Google Play transactions."
      },
      {
        "type": "paragraph",
        "text": "For UK/EEA digital-content purchases made for immediate delivery, the store checkout may ask you to consent to immediate supply and acknowledge that the statutory 14-day cancellation right is lost once supply begins. This does not remove rights or remedies for digital content that is faulty, unavailable or not as described."
      },
      {
        "type": "paragraph",
        "text": "If you believe a purchase is defective, missing or materially different from its description, contact the relevant store and/or gordon@intiesltd.com. Nothing in these terms restricts statutory remedies that cannot lawfully be excluded."
      },
      {
        "type": "heading",
        "text": "9. Apple purchases"
      },
      {
        "type": "paragraph",
        "text": "Apple App Store transactions are handled through Apple's purchase system. Where Apple provides the refund decision/process for the transaction, you can use Apple's Report a Problem/refund process. DRUNK PIGEONS may assist with technical delivery issues but cannot override Apple's platform-level account/payment decisions."
      },
      {
        "type": "heading",
        "text": "10. Google Play purchases"
      },
      {
        "type": "paragraph",
        "text": "Google Play transactions are handled through Google Play. Google provides refund request routes and may direct some requests to the developer depending on timing and circumstances. DRUNK PIGEONS will handle developer-side requests consistently with applicable law, product functionality and Google Play policies."
      },
      {
        "type": "heading",
        "text": "11. Faulty digital content"
      },
      {
        "type": "paragraph",
        "text": "UK consumer law gives statutory rights for paid digital content. If paid content does not conform to the contract - for example, because it is not of satisfactory quality, not fit for an applicable purpose or not as described - legal remedies may include repair/replacement or, in qualifying circumstances, a price reduction/refund. Store processes do not remove those mandatory rights."
      },
      {
        "type": "heading",
        "text": "12. Price changes"
      },
      {
        "type": "paragraph",
        "text": "Future purchase prices may change. A new price does not create an additional charge for a non-consumable product you already validly own. The store price displayed and confirmed before purchase is the price that applies to that transaction, subject to taxes/refunds/adjustments required by law or the store."
      },
      {
        "type": "heading",
        "text": "13. No pay-to-win promise for cosmetic pigeons"
      },
      {
        "type": "paragraph",
        "text": "Premium pigeons are cosmetic/personality choices and must not receive stronger physics, smaller hitboxes, increased scoring or other competitive advantages. Easy Mode is intentionally easier but is separated into the Silly Mode leaderboard so it does not compete with normal Global leaderboard scores."
      },
      {
        "type": "heading",
        "text": "14. Fraud, chargebacks and revoked transactions"
      },
      {
        "type": "paragraph",
        "text": "If Apple/Google reports that a transaction was refunded, revoked, cancelled or fraudulent, the associated paid entitlement may be removed where lawful and technically appropriate. We will not use this section to remove content for a transaction that remains valid and paid."
      },
      {
        "type": "heading",
        "text": "15. Contact"
      },
      {
        "type": "paragraph",
        "text": "Purchase/support contact: gordon@intiesltd.com. Include the app platform, product and store order/transaction reference where available. Never send full card numbers or account passwords."
      }
    ]
  },
  {
    "id": "leaderboard-rules",
    "docNumber": "04",
    "title": "Leaderboard & Fair Play Rules",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/leaderboard-rules",
    "sections": [
      {
        "type": "callout",
        "title": "Purpose",
        "text": "Defines nickname ownership, Global and Silly Mode ranking, anti-cheat rules, score validation, removal powers and player privacy for the online leaderboard."
      },
      {
        "type": "heading",
        "text": "1. Purpose"
      },
      {
        "type": "paragraph",
        "text": "The DRUNK PIGEONS leaderboard is operated by INTIES LTD., company number 17433193. It is a lightweight competitive feature based primarily on best distance. It is intended to be fun and reasonably fair, not a cash competition, gambling service or professional esports ranking."
      },
      {
        "type": "heading",
        "text": "2. Anonymous player identity"
      },
      {
        "type": "paragraph",
        "text": "Leaderboard participation does not require an email/password account. The Game assigns or stores a random player identifier locally and associates it with your leaderboard nickname and best scores. The raw player identifier is not intended to appear publicly."
      },
      {
        "type": "heading",
        "text": "3. Nickname rules"
      },
      {
        "type": "paragraph",
        "text": "One nickname belongs to one player identifier across DRUNK PIGEONS. Nickname ownership is global across normal/Global and Silly Mode leaderboards, not separate by leaderboard."
      },
      {
        "type": "paragraph",
        "text": "Nickname matching is normalised so trivial variations cannot be used by two different people. In particular, case differences, leading/trailing whitespace and invisible/zero-width characters must not create a second visually identical nickname. The backend, not only the client, enforces uniqueness."
      },
      {
        "type": "paragraph",
        "text": "Nicknames must comply with format/length rules and must not contain unlawful content, targeted harassment, hate content, explicit sexual content, credible threats, another person's private information, misleading official/developer impersonation or other content that reasonably creates safety, legal or platform-policy concerns. A profanity filter may reject additional terms appropriate for a general-audience game."
      },
      {
        "type": "heading",
        "text": "4. Global and Silly Mode leaderboards"
      },
      {
        "type": "paragraph",
        "text": "Normal gameplay best distance is recorded on the Global leaderboard. Easy Mode best distance is recorded separately on the Silly Mode leaderboard. Easy Mode scores must never be submitted to or ranked on the Global leaderboard. Random Manor only selects standard manors and does not convert a normal run into Easy Mode."
      },
      {
        "type": "heading",
        "text": "5. Best score logic"
      },
      {
        "type": "paragraph",
        "text": "The leaderboard keeps an authoritative best distance for the relevant player/mode. A new valid run replaces the stored best only if it exceeds the existing best. A manual restart, menu navigation or other non-death action must not create a fake death score submission. A rewarded revive continues the same run; the final distance for that run is the relevant result."
      },
      {
        "type": "heading",
        "text": "6. Fair play"
      },
      {
        "type": "paragraph",
        "text": "You must play through the intended client and controls. You may not knowingly submit a result created or altered by:"
      },
      {
        "type": "bullets",
        "items": [
          "editing local memory, save data, network traffic or run payloads to fabricate distance or metadata;",
          "modifying the client to alter scoring, physics or leaderboard mode flags;",
          "bots, automated input or scripts used to produce artificial leaderboard scores;",
          "replaying a run identifier or duplicate submission in an attempt to create false results;",
          "bypassing rate limits by rotating identifiers, abusing proxies or generating excessive anonymous registrations/submissions;",
          "spoofing Easy/normal mode or other run metadata to place a score on the wrong leaderboard; or",
          "any other intentional manipulation that creates a score not produced by ordinary play."
        ]
      },
      {
        "type": "heading",
        "text": "7. Automated validation"
      },
      {
        "type": "paragraph",
        "text": "The backend may validate run identifiers, player identifiers, mode, duration, distance, progression/chip sanity, duplicate submissions, request frequency, app/build information and other technical signals. A plausible score is not automatically proof of legitimacy, and the Game may improve anti-cheat checks over time."
      },
      {
        "type": "paragraph",
        "text": "The Game currently uses lightweight plausibility/anti-abuse controls rather than invasive device surveillance or a heavyweight competitive anti-cheat system. This means no system can guarantee that every fraudulent score will be detected immediately."
      },
      {
        "type": "heading",
        "text": "8. Rejected, flagged and removed scores"
      },
      {
        "type": "paragraph",
        "text": "A submission may be rejected or withheld where it is malformed, duplicated, technically impossible, submitted at abusive frequency, associated with invalid identifiers, inconsistent with the declared game mode, or otherwise fails server validation. Suspicious high-ranking runs may be flagged for additional review rather than immediately promoted to the top rankings."
      },
      {
        "type": "paragraph",
        "text": "We may remove or correct a leaderboard record where there is reasonable evidence of manipulation, a security incident, database error, prohibited nickname, legal requirement or clear breach of these rules. We will act in good faith and avoid penalising a player merely for being unusually skilled."
      },
      {
        "type": "heading",
        "text": "9. Rate limits and service protection"
      },
      {
        "type": "paragraph",
        "text": "The leaderboard uses per-player and network/IP rate limits to reduce automated abuse and database flooding. Limits are intended to be generous for ordinary players and shared networks. Attempts to deliberately bypass them may result in temporary refusal of leaderboard requests."
      },
      {
        "type": "heading",
        "text": "10. Offline play and outages"
      },
      {
        "type": "paragraph",
        "text": "The Game may remain playable while leaderboard services are unavailable. A leaderboard submission can be delayed, retried or unavailable because of connectivity or backend maintenance. We do not guarantee that every offline run can be recovered/submitted if the app/device loses the data needed to prove or identify it."
      },
      {
        "type": "heading",
        "text": "11. Leaderboard privacy"
      },
      {
        "type": "paragraph",
        "text": "The public leaderboard should show only the nickname, rank/distance and other deliberately public game-ranking information. It should not reveal the raw player identifier, IP address, purchase status, advertising identifier or anti-cheat/security logs."
      },
      {
        "type": "heading",
        "text": "12. No prizes or property right in rank"
      },
      {
        "type": "paragraph",
        "text": "Leaderboard position has no cash value and is not a property right. Rankings naturally change as other players submit better scores, and may also change when fraudulent/invalid records are removed or the leaderboard is reset/retired as part of a clearly communicated service change."
      },
      {
        "type": "heading",
        "text": "13. Questions or disputes"
      },
      {
        "type": "paragraph",
        "text": "If you believe your nickname or legitimate score was wrongly rejected or removed, contact gordon@intiesltd.com with the support/player identifier and relevant details. We may be unable to restore a run if sufficient technical evidence is no longer retained, particularly after the transient run-record retention period."
      }
    ]
  },
  {
    "id": "privacy-choices",
    "docNumber": "10",
    "title": "Privacy Choices & Data Deletion",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/privacy-choices",
    "sections": [
      {
        "type": "callout",
        "title": "Purpose",
        "text": "A short player-facing notice suitable for the in-app Legal/Privacy area and, if hosted publicly, as an Apple Privacy Choices URL."
      },
      {
        "type": "heading",
        "text": "Your privacy choices in DRUNK PIGEONS"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS is designed to collect as little information as practical. You can play without creating an email/password account. The online leaderboard uses a random player identifier and the nickname you choose."
      },
      {
        "type": "subheading",
        "text": "Advertising choices"
      },
      {
        "type": "paragraph",
        "text": "Where privacy law or Google policy requires a consent message, use the in-app Privacy Choices control to review or change your advertising consent. If the option is required for your region, it should remain available after the first choice so you can change your mind."
      },
      {
        "type": "paragraph",
        "text": "On iPhone/iPad, you can also manage app tracking permission through iOS Settings. Declining tracking must not prevent you from playing the core game."
      },
      {
        "type": "subheading",
        "text": "Remove Ads"
      },
      {
        "type": "paragraph",
        "text": "If you own Remove Ads, automatic/forced interstitial ads are removed. Optional rewarded revive ads may still be offered because you decide whether to watch one in exchange for a revive. You can ignore the rewarded option and continue normally."
      },
      {
        "type": "subheading",
        "text": "Delete leaderboard data"
      },
      {
        "type": "paragraph",
        "text": "You can delete your online leaderboard record directly in the app using %%DELETE%%. The leaderboard is anonymous and is not normally linked to your real name or email address, so no email address, real name or identifier is required to make the request."
      },
      {
        "type": "paragraph",
        "text": "A deletion request can remove the leaderboard player record and associated server data that we are not legally required to retain. Temporary run records already delete automatically after short retention periods. Protected backups may take a limited period to rotate out."
      },
      {
        "type": "subheading",
        "text": "Delete local data"
      },
      {
        "type": "paragraph",
        "text": "You can clear/reset in-app settings where controls are provided, or delete the app/device data through your operating system. This removes local preferences but does not automatically delete an online leaderboard record; use the request process above for server-held leaderboard data."
      },
      {
        "type": "subheading",
        "text": "Purchase information"
      },
      {
        "type": "paragraph",
        "text": "Apple and Google handle your store account and payment details. DRUNK PIGEONS may process transaction/entitlement information needed to confirm and restore purchases, but does not receive your full card details."
      },
      {
        "type": "subheading",
        "text": "Questions"
      },
      {
        "type": "paragraph",
        "text": "For privacy questions, access/correction/deletion requests or concerns, contact INTIES LTD. at gordon@intiesltd.com. Correspondence address: 128 City Road, London, EC1V 2NX, United Kingdom. The full Privacy Policy explains your rights and how data is used in more detail."
      }
    ]
  },
  {
    "id": "online-safety",
    "docNumber": "12",
    "title": "Online Safety, Reporting & Complaints",
    "version": "2.0",
    "lastUpdated": "3 September 2026",
    "status": "PUBLIC DRAFT",
    "externalUrl": "https://intiesltd.com/drunk-pigeons/online-safety",
    "sections": [
      {
        "type": "callout",
        "title": "PUBLICATION GATE",
        "text": "Do not publish this policy or submit the app until the described in-app Report, Hide/Block, rules-acceptance and moderator-review controls are live and tested."
      },
      {
        "type": "heading",
        "text": "1. Who we are"
      },
      {
        "type": "paragraph",
        "text": "DRUNK PIGEONS is published by INTIES LTD., registered in England and Wales under company number 17433193. Registered office: 128 City Road, London, EC1V 2NX, United Kingdom. Online-safety and support contact: gordon@intiesltd.com."
      },
      {
        "type": "heading",
        "text": "2. What user content exists"
      },
      {
        "type": "paragraph",
        "text": "Players can choose a short public leaderboard nickname and submit a score. Other players may see that nickname and score. DRUNK PIGEONS does not provide player-to-player chat, direct messages, image/video/audio uploads, links, comments, user posts or searchable public profiles."
      },
      {
        "type": "heading",
        "text": "3. Agreeing to the rules"
      },
      {
        "type": "paragraph",
        "text": "Before a nickname is submitted, the production app will require the player to accept the Terms of Use, Leaderboard & Fair Play Rules and this policy. A player who does not agree can continue using the core game without submitting a public nickname or score."
      },
      {
        "type": "heading",
        "text": "4. Content and behaviour we prohibit"
      },
      {
        "type": "paragraph",
        "text": "A nickname, score submission or related conduct must not contain, promote, disguise or facilitate:"
      },
      {
        "type": "bullets",
        "items": [
          "illegal content or instructions, encouragement or assistance for crime;",
          "terrorism, violent extremism, child sexual exploitation or abuse, grooming or sexual content involving a child;",
          "hate, slurs, dehumanising or discriminatory attacks based on race, nationality, ethnicity, religion, sex, sexual orientation, disability, gender reassignment or another protected characteristic;",
          "harassment, stalking, bullying, credible threats, abuse, sexual content or non-consensual intimate content;",
          "encouragement or instructions for suicide, serious self-harm, eating disorders, dangerous challenges, weapons, unlawful drugs, fraud or exploitation;",
          "personal information, contact details, advertising, spam, URLs, scams, impersonation or misleading affiliation;",
          "profanity or attempts to evade the safety rules using spacing, punctuation, leetspeak, homoglyphs, phonetic spellings, transliteration or deliberate misspelling;",
          "content that attacks or deliberately demeans a deity, religion or religious figure. This is an additional DRUNK PIGEONS house rule, whether or not the content is unlawful. Respectful positive religious phrases may be allowed, while religious names or titles used alone may be reserved or rejected;",
          "cheating, manipulated scores, automated submissions, security attacks, purchase fraud or repeated attempts to bypass moderation."
        ]
      },
      {
        "type": "heading",
        "text": "5. How moderation works"
      },
      {
        "type": "paragraph",
        "text": "We use proportionate automated checks and human review. Automated controls may normalise characters, remove separators, detect leetspeak/phonetic evasion, compare restricted terms and patterns, apply contextual rules, and rate-limit repeated attempts. They are designed with allowlists and review paths to reduce false positives; they are not treated as infallible."
      },
      {
        "type": "paragraph",
        "text": "We may reject a nickname before publication, hide or remove a leaderboard entry, reset or invalidate a score, restrict submissions, preserve evidence, or suspend an identifier's online features. We may act without advance notice where needed to prevent harm, comply with law or protect the service. We will consider context and proportionality."
      },
      {
        "type": "heading",
        "text": "6. Reporting and hiding content"
      },
      {
        "type": "paragraph",
        "text": "The production leaderboard will place clearly labelled Report and Hide/Block controls beside public entries. Reporting sends the entry and selected reason for review. Hiding/blocking removes that player's entry from the reporting player's view where technically appropriate. A person may also report content to us at gordon@intiesltd.com and should include the nickname, score/rank, approximate date/time and a screenshot if available. Do not send illegal files or payment-card details."
      },
      {
        "type": "paragraph",
        "text": "Reports may be made without creating a conventional account. Misusing reports to harass others or flood the service is prohibited."
      },
      {
        "type": "heading",
        "text": "7. Urgent and illegal content"
      },
      {
        "type": "paragraph",
        "text": "If content suggests an immediate risk to life, contact emergency services first. We prioritise credible reports of illegal content and child-safety concerns, aim to prevent users encountering illegal content, and will remove illegal content swiftly when we become aware of it. We may preserve records and report or disclose information to law-enforcement, regulators, stores or safeguarding bodies where required or lawful."
      },
      {
        "type": "heading",
        "text": "8. Complaints and appeals"
      },
      {
        "type": "paragraph",
        "text": "You may complain about content, a moderation decision, reporting access, or the way a report was handled by emailing gordon@intiesltd.com with the relevant Support ID and facts. We aim to acknowledge ordinary complaints within three business days and give an outcome or progress update within ten business days, although complex, safety-critical or legal matters may take longer. A different reviewer will be used where reasonably practicable."
      },
      {
        "type": "paragraph",
        "text": "An appeal does not automatically restore content while it is under review. We may uphold, change or reverse a decision, and we will explain the outcome unless doing so would create a safety, security or legal risk."
      },
      {
        "type": "heading",
        "text": "9. Children and younger players"
      },
      {
        "type": "paragraph",
        "text": "The game is not marketed to young children, but its cartoon design means it may be accessed by under-18s. The leaderboard is deliberately limited to a nickname and score: there is no direct contact, media upload or link sharing. We apply the same high-privacy and moderation defaults to all players and give priority to reports involving children."
      },
      {
        "type": "heading",
        "text": "10. Records, privacy and reviews"
      },
      {
        "type": "paragraph",
        "text": "We keep proportionate moderation records to investigate reports, prevent repeated abuse, demonstrate decisions and meet legal duties. Retention and rights are described in the Privacy Policy and Data Retention Schedule. We review this policy and the related risk assessments at least annually and before a significant change to the leaderboard or other social feature."
      },
      {
        "type": "heading",
        "text": "11. Company information"
      },
      {
        "type": "paragraph",
        "text": "INTIES LTD. is registered in England and Wales under company number 17433193. Registered office: 128 City Road, London, EC1V 2NX, United Kingdom. Contact: gordon@intiesltd.com."
      }
    ]
  }
];

export const LEGAL_DOC_IDS = LEGAL_DOCUMENTS.map((d) => d.id);
export function getLegalDoc(id) {
  return LEGAL_DOCUMENTS.find((d) => d.id === id) || null;
}

// Documents a player must accept before submitting a first public nickname:
// Terms of Use, Leaderboard & Fair Play Rules, Online Safety Policy.
export const ACCEPTANCE_DOC_IDS = ['terms', 'leaderboard-rules', 'online-safety'];
export const ACCEPTANCE_VERSION = ACCEPTANCE_DOC_IDS
  .map((id) => (getLegalDoc(id) || {}).version || '?')
  .join('|'); // e.g. "2.0|2.0|2.0" — changes if any of the three docs is revised
