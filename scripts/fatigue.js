const FATIGUED_EFFECT_ID = 'Compendium.pf2e.conditionitems.HL2l2VRSaQHu9lUw';
const SECONDS_IN_HOUR = 3600;

class Fatigue {
    static ID = 'pf2e-fatigue';

    static FLAGS = {
        EXPIRE_TIME: 'expireTime',
        IS_FATIGUED: 'isFatigued'
    }

    static SETTINGS = {
        FATIGUE_DURATION: 'fatigue-duration'
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
            hint: `PF2E-FATIGUE.settings.${this.SETTINGS.FATIGUE_DURATION}.Hint`,
        });
    }

    static ensureAllTimersSet() {
        //set timer for any characters that don't already have one
        game.actors.filter((actor) => actor.type === "character").forEach((character) => {
            if (FatigueData.getTracker(character) == null) {
                this.startTimer(character);
            }
        });
    }

    static checkTimer(worldTime) {
        const fatigueDelay = game.settings.get(Fatigue.ID, Fatigue.SETTINGS.FATIGUE_DURATION);
        game.actors.filter((actor) => actor.type === "character").forEach(character => {
            if (worldTime >= FatigueData.getTracker(character) + (fatigueDelay * SECONDS_IN_HOUR)
                && true != FatigueData.getFatigued(character)) {
                FatigueData.setFatigued(character, true);
                this.log(false, character.name + " has gained fatigued!");
                this.addEffect(character);
            }
        });
    }

    static startTimer(character) {
        const worldTime = game.time._time.worldTime;
        this.log(false, character.name + ' rested for the night at ' + worldTime);
        FatigueData.setTracker(character, worldTime);
        FatigueData.setFatigued(character, false);
    }

    static async addEffect(character) {
        const effect = (await fromUuid(FATIGUED_EFFECT_ID)).toObject();
        effect.flags.core.sourceId = FATIGUED_EFFECT_ID;
        await character.createEmbeddedDocuments('Item', [effect]);
    }
}

class FatigueData {
    static setTracker(character, startTime) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.EXPIRE_TIME, startTime);
    }

    static getTracker(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.EXPIRE_TIME);
    }

    static setFatigued(character, isFatigued) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED, isFatigued);
    }

    static getFatigued(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED);
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

Hooks.on("pf2e.restForTheNight", (character) => Fatigue.startTimer(character));

Hooks.on("updateWorldTime", (worldTime) => Fatigue.checkTimer(worldTime));