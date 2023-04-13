const FATIGUED_EFFECT_ID = 'Compendium.pf2e.conditionitems.HL2l2VRSaQHu9lUw';
const FORGE_DAYS_REST_FEAT_ID = 'Compendium.pf2e.feats-srd.ZxiAMposVPDNPwxI';
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
        FORGE_DAYS_REST_DURATION: 'forge-days-rest-duration'
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
            hint: `PF2E-FATIGUE.settings.${this.SETTINGS.FATIGUE_DURATION}.Hint`,
        });

        game.settings.register(this.ID, this.SETTINGS.FORGE_DAYS_REST_DURATION, {
            name: `PF2E-FATIGUE.settings.${this.SETTINGS.FORGE_DAYS_REST_DURATION}.Name`,
            default: 4,
            type: Number,
            scope: 'world',
            config: true,
            hint: `PF2E-FATIGUE.settings.${this.SETTINGS.FORGE_DAYS_REST_DURATION}.Hint`,
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
        const waitTimeInHours = game.settings.get(Fatigue.ID, Fatigue.SETTINGS.FATIGUE_DURATION);

        game.actors.filter((actor) => actor.type === "character").forEach(character => {

            let adjustedWaitTimeInHours = waitTimeInHours;
            //add more time when Forge Day's Rest applies
            if (true === FatigueData.getForgeDaysRested(character)) {
                this.log(false, character.name + " has FDR");
                adjustedWaitTimeInHours += game.settings.get(Fatigue.ID, Fatigue.SETTINGS.FORGE_DAYS_REST_DURATION);
            }
            const waitTimeInSeconds = adjustedWaitTimeInHours * SECONDS_IN_HOUR;

            if (worldTime >= FatigueData.getTracker(character) + (waitTimeInSeconds)
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
        if (this.hasItem(character, FORGE_DAYS_REST_FEAT_ID)) {
            this.log(false, character.name + " has Forge Day's Rest!");
            new ForgeDaysRestForm(character).render(true);
        };
    }

    static hasItem(character, itemID) {
        return this.getItemFromActor(character, itemID) != null;;
    }

    static getItemFromActor(actor, sourceId) {
        return actor.items.find(item => item.getFlag("core", "sourceId") === sourceId);
    }
    static async addEffect(character) {
        const effect = (await fromUuid(FATIGUED_EFFECT_ID)).toObject();
        effect.flags.core.sourceId = FATIGUED_EFFECT_ID;
        await character.createEmbeddedDocuments('Item', [effect]);
    }
}

class FatigueData {
    static setTracker(character, startTime) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.START_TIME, startTime);
    }

    static getTracker(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.START_TIME);
    }

    static setFatigued(character, isFatigued) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED, isFatigued);
    }

    static getFatigued(character) {
        return character.getFlag(Fatigue.ID, Fatigue.FLAGS.IS_FATIGUED);
    }

    static setForgeDaysRested(character, hasForgeDaysRested) {
        return character.setFlag(Fatigue.ID, Fatigue.FLAGS.HAS_RESTED_TWELVE_HOURS, hasForgeDaysRested);
    }

    static getForgeDaysRested(character) {
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
            FatigueData.setForgeDaysRested(this.character, true);
            break;
          }
    
          case 'no': {
            Fatigue.log(false, this.character.name +" did not sleep for 12 hours");
            FatigueData.setForgeDaysRested(this.character, false);
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

Hooks.on("pf2e.restForTheNight", (character) => Fatigue.startTimer(character));

Hooks.on("updateWorldTime", (worldTime) => Fatigue.checkTimer(worldTime));