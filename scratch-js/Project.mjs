import Trigger from "./Trigger.mjs";
import Renderer from "./Renderer.mjs";
import Input from "./Input.mjs";
import { Stage } from "./Sprite.mjs";

export default class Project {
  constructor(stage, sprites = {}) {
    this.stage = stage;
    this.sprites = sprites;

    for (const sprite of this.spritesAndClones) {
      sprite._project = this;
    }
    this.stage._project = this;

    this.renderer = new Renderer(this);
    this.input = new Input(this.stage, this.renderer.stage, key => {
      this.fireTrigger(Trigger.KEY_PRESSED, { key });
    });

    this.runningTriggers = [];

    this.restartTimer();

    this.answer = null;

    this.step();
  }

  attach(renderTarget) {
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.stage.addEventListener("click", () => {
      const wasClicked = sprite => {
        if (sprite instanceof Stage) {
          return true;
        }

        return this.renderer.checkPointCollision(
          sprite,
          {
            x: this.input.mouse.x,
            y: this.input.mouse.y
          },
          false
        );
      };

      let matchingTriggers = [];
      for (let i = 0; i < this.spritesAndStage.length; i++) {
        const sprite = this.spritesAndStage[i];
        const spriteClickedTriggers = sprite.triggers.filter(tr =>
          tr.matches(Trigger.CLICKED, {})
        );
        if (spriteClickedTriggers.length > 0) {
          if (wasClicked(sprite)) {
            matchingTriggers = [
              ...matchingTriggers,
              ...spriteClickedTriggers.map(trigger => ({
                trigger,
                target: sprite
              }))
            ];
          }
        }
      }

      this._startTriggers(matchingTriggers);
    });
  }

  greenFlag() {
    this.fireTrigger(Trigger.GREEN_FLAG);
    this.input.focus();
  }

  step() {
    // Step all triggers
    const alreadyRunningTriggers = this.runningTriggers;
    for (let i = 0; i < alreadyRunningTriggers.length; i++) {
      alreadyRunningTriggers[i].trigger.step();
    }

    // Remove finished triggers
    this.runningTriggers = this.runningTriggers.filter(
      ({ trigger }) => !trigger.done
    );

    this.renderer.update(this.stage, this.spritesAndClones);

    window.requestAnimationFrame(this.step.bind(this));
  }

  fireTrigger(trigger, options) {
    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer();
      this.stopAllSounds();
      this.runningTriggers = [];

      for (const spriteName in this.sprites) {
        const sprite = this.sprites[spriteName];
        sprite.clones = [];
      }

      for (const sprite of this.spritesAndStage) {
        sprite.effects.clear();
        sprite.audioEffects.clear();
      }
    }

    // Find triggers which match conditions
    let matchingTriggers = [];
    for (let i = 0; i < this.spritesAndStage.length; i++) {
      const sprite = this.spritesAndStage[i];
      const spriteTriggers = sprite.triggers.filter(tr =>
        tr.matches(trigger, options)
      );

      matchingTriggers = [
        ...matchingTriggers,
        ...spriteTriggers.map(trigger => ({ trigger, target: sprite }))
      ];
    }

    return this._startTriggers(matchingTriggers);
  }

  _startTriggers(triggers) {
    // Only add these triggers to this.runningTriggers if they're not already there.
    // TODO: if the triggers are already running, they'll be restarted but their execution order is unchanged.
    // Does that match Scratch's behavior?
    for (const trigger of triggers) {
      if (
        !this.runningTriggers.find(
          runningTrigger =>
            trigger.trigger === runningTrigger.trigger &&
            trigger.target === runningTrigger.target
        )
      ) {
        this.runningTriggers.push(trigger);
      }
    }
    return Promise.all(
      triggers.map(({ trigger, target }) => {
        return trigger.start(target);
      })
    );
  }

  get spritesAndClones() {
    return Object.values(this.sprites).flatMap(sprite => sprite.andClones());
  }

  get spritesAndStage() {
    return [...this.spritesAndClones, this.stage];
  }

  stopAllSounds() {
    for (const target of this.spritesAndStage) {
      target.stopAllOfMySounds();
    }
  }

  restartTimer() {
    this.timerStart = new Date();
  }

  async askAndWait(question) {
    this.answer = await this.renderer.displayAskBox(question);
  }
}
