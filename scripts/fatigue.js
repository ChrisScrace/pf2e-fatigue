const FATIGUED_EFFECT_ID = 'Compendium.pf2e.conditionitems.HL2l2VRSaQHu9lUw';
const FORGE_DAYS_REST_FEAT_ID = 'Compendium.pf2e.feats-srd.ZxiAMposVPDNPwxI';
const STEEL_SKIN_FEAT_ID = 'Compendium.pf2e.feats-srd.uxwHHjWs3ehqtG4b';
const ARMORED_REST_FEAT_ID = 'Compendium.pf2e.feats-srd.OmjTt8eR1Q3SmkPp';
const SECONDS_IN_HOUR = 3600;

class Fatigue {
    static ID = 'pf2e-fatigue';

    static FLAGS = {
        START_TIME: 'startTime',
        IS_FATIGUED: 'isFatigued',
        HAS_RESTED_TWELVE_HOURS: "hasRestedTwelveHours"
    }

    static SETTINGS = {
        FATIGUE_DURATION: 'fatigue-duration',
        FORGE_DAYS_REST_DURATION: 'forge-days-rest-duration',
        REST_IN_ARMOR_FATIGUE: 'rest-in-armor-fatigue'
    }

    static TEMPLATES = {
        FATIGUE: `modules/${this.ID}/templates/rest-for-twelve.hbs`
    }

    static log(force, ...args) {
        const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

        if (shouldLog) {
            console.log(this.ID, '|', ...args);
        }
    }

    static initialize() {
        game.settings.register(this.ID, this.SETTINGS.FATIGUE_DURATION, {
            name: `PF2E-FATIGUE.settings.${this.SETTINGS.FATIGUE_DURATION}.Name`,
            default: 16,
            type: Number,
            scope: 'world',
            config: true,
            hint: `PF2E-FATIGUE.settings.${this.SETTINGS.FATIGUE_DURATION}.Hint`
        });

        game.settings.register(this.ID, this.SETTINGS.FORGE_DAYS_REST_DURATION, {
            name: `PF2E-FATIGUE.settings.${this.SETTINGS.FORGE_DAYS_REST_DURATION}.Name`,
            default: 4,
            type: Number,
            scope: 'world',
            config: true,
            hint: `PF2E-FATIGUE.settings.${this.SETTINGS.FORGE_DAYS_REST_DURATION}.Hint`
        });

        game.settings.register(this.ID, this.SETTINGS.REST_IN_ARMOR_FATIGUE, {
            name: `PF2E-FATIGUE.settings.${this.SETTINGS.REST_IN_ARMOR_FATIGUE}.Name`,
            default: true,
            type: Boolean,
            scope: 'world',
            config: true
        });
    }

    static ensureAllTimersSet() {
        //set timer for any characters that don't already have one
        game.actors.filter((actor) => actor.type === "character").forEach((character) => {
            if (FatigueData.getStartTime(character) == null) {
                this.startTimer(character);
            }
        });
    }

    static checkTimer(worldTime) {
        if (game.user.role == 4) {
            const waitTimeInHours = game.settings.get(Fatigue.ID, Fatigue.SETTINGS.FATIGUE_DURATION);

            game.actors.filter((actor) => actor.type === "character").forEach(character => {

                let adjustedWaitTimeInHours = waitTimeInHours;
                //add more time when Forge Day's Rest applies
                if (true === FatigueData.getHasForgeDaysRested(character)) {
                    this.log(false, character.name + " has FDR");
                    adjustedWaitTimeInHours += game.settings.get(Fatigue.ID, Fatigue.SETTINGS.FORGE_DAYS_REST_DURATION);
                }
                const waitTimeInSeconds = adjustedWaitTimeInHours * SECONDS_IN_HOUR;

                if (worldTime >= FatigueData.getStartTime(character) + (waitTimeInSeconds)
                    && true != FatigueData.getIsFatigued(character)) {
                    FatigueData.setIsFatigued(character, true);
                    this.log(false, character.name + " has gained fatigued!");
                    this.addEffect(character);
                }
            });
        }
    }

    static startTimer(character) {
        const worldTime = game.time._time.worldTime;
        this.log(false, character.name + ' rested for the night at ' + worldTime);
        FatigueData.setStartTime(character, worldTime);
        FatigueData.setIsFatigued(character, false);
        if (this.hasItem(character, FORGE_DAYS_REST_FEAT_ID)) {
            this.log(false, character.name + " has Forge Day's Rest!");
            new ForgeDaysRestForm(character).render(true);
        };
    }

    static async restForTheNight(character) {
        this.startTimer(character);
        //if wearing armor then give fatigued effect
        if (sleepingInArmorIsOn()
            && isWearingArmor()
            && armorIsNotComfortable()
            && doesNotHaveArmoredRestFeat()
            && doesNotBenefitFromSteelSkin()) {
            await Fatigue.createChatEmote(character, character.name + game.i18n.localize("PF2E-FATIGUE.rested-in-armor"));
            this.addEffect(character);
        }

        function doesNotBenefitFromSteelSkin() {
            const category = character.wornArmor.category;
            return Fatigue.hasItem(character, STEEL_SKIN_FEAT_ID)
                ? !(category === 'medium' || (category === 'heavy' && character.system.martial.heavy.rank >= 3))
                : true;
        }

        function doesNotHaveArmoredRestFeat() {
            return !Fatigue.hasItem(character, ARMORED_REST_FEAT_ID);
        }

        function armorIsNotComfortable() {
            return !character.wornArmor.traits.has('comfort');
        }

        function sleepingInArmorIsOn() {
            return game.settings.get(Fatigue.ID, Fatigue.SETTINGS.REST_IN_ARMOR_FATIGUE);
        }

        function isWearingArmor() {
            return character.wornArmor != null;
        }
    }

    static async createChatEmote(actor, text) {
        const content = await renderTemplate("./systems/pf2e/templates/chat/action/content.hbs", { imgPath: actor.img, message: text });
        const flavor = await renderTemplate("./systems/pf2e/templates/chat/action/flavor.hbs", { action: { title: "", typeNumber: String("") } });
        await ChatMessage.create({
            type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
            speaker: ChatMessage.getSpeaker({ character: actor }),
            flavor,
            content,
            flags: {
                "pf2e-fatigue": {
                    actorId: actor.id
                }
            }
        });
    }

    static hasItem(character, itemID) {
        return this.getItemFromActor(character, itemID) != null;;
    }

    static getItemFromActor(actor, sourceId) {
        return actor.items.find(item => item.getFlag("core", "_stats.compendiumSource") === sourceId);
    }
    static async addEffect(character) {
        if (!Fatigue.hasItem(character, FATIGUED_EFFECT_ID)) {
            this.log(false, character.name + " creating effect");
            const effect = (await fromUuid(FATIGUED_EFFECT_ID)).toObject();
            await character.createEmbeddedDocuments('Item', [effect]);
        }
    }
}

class FatigueData {
    static setStartTime(character, startTime) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.START_TIME, startTime);
    }

    static getStartTime(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.START_TIME);
    }

    static setIsFatigued(character, isFatigued) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED, isFatigued);
    }

    static getIsFatigued(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED);
    }

    static setHasForgeDaysRested(character, hasForgeDaysRested) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.HAS_RESTED_TWELVE_HOURS, hasForgeDaysRested);
    }

    static getHasForgeDaysRested(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.HAS_RESTED_TWELVE_HOURS);
    }
}

class ForgeDaysRestForm extends FormApplication {
    constructor(character) {
        super();
        this.character = character;
    }

    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            height: 'auto',
            width: 'auto',
            id: 'rested-for-twelve',
            template: Fatigue.TEMPLATES.FATIGUE,
            title: 'Forge Day\'s Rest',
            submitOnChange: true,
            closeOnSubmit: true
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', "[data-action]", this._handleButtonClick.bind(this));
    }

    async _handleButtonClick(event) {
        const clickedElement = $(event.currentTarget);
        const action = clickedElement.data().action;

        switch (action) {
            case 'yes': {
                Fatigue.log(false, this.character.name + " slept for 12 hours");
                FatigueData.setHasForgeDaysRested(this.character, true);
                break;
            }

            case 'no': {
                Fatigue.log(false, this.character.name + " did not sleep for 12 hours");
                FatigueData.setHasForgeDaysRested(this.character, false);
                break;
            }

            default:
                ToDoList.log(false, 'Invalid action detected', action);
        }
        this.close();
    }

    getData(options) {
        return {
            character: options.character
        }
    }
}

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => { registerPackageDebugFlag(Fatigue.ID); });

Hooks.once("ready", async function () { Fatigue.ensureAllTimersSet(); });

Hooks.once("init", async function () { Fatigue.initialize(); });

Hooks.on("createActor", (actor) => {
    if (actor.type === "character") {
        Fatigue.startTimer(actor);
    }
})

Hooks.on("pf2e.restForTheNight", (character) => Fatigue.restForTheNight(character));

Hooks.on("updateWorldTime", (worldTime) => Fatigue.checkTimer(worldTime));