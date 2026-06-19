var template = `
<div v-if="visible" class="custom-dialog-overlay" @keyup.esc="handleEscPressed">
	<div class="custom-dialog">
		<p class="custom-dialog-header">{{title}}</p>
		<div class="custom-dialog-body">
			<slot>
				<p class="custom-dialog-content">{{content}}</p>
				<template v-for="(field,index) in formFields">
					<label v-if="showLabel && field.type !== 'check'">{{field.label}} :</label>
					<textarea v-if="field.type === 'area'"
						:style="{gridColumnEnd: showLabel ? null : 'span 2'}"
						:placeholder="field.label"
						:tabindex="index+1"
						:name="field.name"
						ref="input"
						v-model="field.value"
						@focus="$event.target.select()"
						@keyup="handleInput(index)">
					</textarea>
					<label v-else-if="field.type === 'check'" class="checkbox-field">
						<input type="checkbox"
						  :name="field.name"
							v-model="field.value"
							:tabindex="index+1">{{field.label}}
					</label>
					<div v-else-if="field.type === 'tags'"
						class="tag-editor"
						:style="{gridColumnEnd: showLabel ? null : 'span 2'}">
						<div class="tag-badge-container">
							<span v-for="(tag, tagIndex) in field.tagsList" :key="tagIndex" class="tag-badge">
								{{ tag }}
								<i class="fas fa-times tag-badge-remove" @click="removeTag(index, tagIndex)"></i>
							</span>
							<div class="tag-input-container">
								<input type="text"
									class="tag-input"
									placeholder="Add tag..."
									v-model="field.tagsInputValue"
									:tabindex="index+1"
									@input="handleTagInputEvent(index)"
									@keydown.enter.prevent="addTagFromInput(index)"
									@keydown.tab.prevent="addTagFromInput(index)"
									@keydown.delete="handleTagDeleteKey(index)"
									ref="input">
							</div>
						</div>
					</div>
					<input v-else
						:style="{gridColumnEnd: showLabel ? null : 'span 2'}"
						:type="fieldType(field)"
						:placeholder="field.label"
						:tabindex="index+1"
						:name="field.name"
						ref="input"
						v-model="field.value"
						@focus="$event.target.select()"
						@keyup="handleInput(index)"
						@keyup.enter="handleInputEnter(index)">
					<button :ref="'suggestion-'+index"
						v-if="field.suggestion"
						@click="handleInputEnter(index)"
						class="suggestion">{{field.suggestion}}</button>
				</template>
			</slot>
		</div>
		<div class="custom-dialog-footer">
			<i v-if="loading" class="fas fa-fw fa-spinner fa-spin"></i>
			<slot v-else name="custom-footer">
				<a v-if="secondText"
					:tabindex="btnTabIndex+1"
					@click="handleSecondClick"
					@keyup.enter="handleSecondClick"
					class="custom-dialog-button">{{secondText}}
				</a>
				<a :tabindex="btnTabIndex"
					ref="mainButton"
					@click="handleMainClick"
					@keyup.enter="handleMainClick"
					class="custom-dialog-button main">{{mainText}}
				</a>
			</slot>
		</div>
	</div>
</div>`;

export default {
	template: template,
	props: {
		title: String,
		loading: Boolean,
		visible: Boolean,
		content: {
			type: String,
			default: "",
		},
		fields: {
			type: Array,
			default() {
				return [];
			},
		},
		showLabel: {
			type: Boolean,
			default: false,
		},
		mainText: {
			type: String,
			default: "OK",
		},
		secondText: String,
		mainClick: {
			type: Function,
			default() {
				this.visible = false;
			},
		},
		secondClick: {
			type: Function,
			default() {
				this.visible = false;
			},
		},
		escPressed: {
			type: Function,
			default() {
				this.visible = false;
			},
		},
	},
	data() {
		return {
			formFields: [],
		};
	},
	computed: {
		btnTabIndex() {
			return this.fields.length + 1;
		},
	},
	watch: {
		fields: {
			immediate: true,
			handler() {
				this.formFields = this.fields.map((field) => {
					if (typeof field === "string")
						return {
							name: field,
							label: field,
							value: "",
							type: "text",
							dictionary: [],
							separator: " ",
							suggestion: undefined,
						};

					if (typeof field === "object") {
						var tagsList = [];
						if (field.type === "tags") {
							if (Array.isArray(field.value)) {
								tagsList = field.value.map(t => t.trim()).filter(t => t !== "");
							} else if (typeof field.value === "string") {
								tagsList = field.value
									.split(/\s*,\s*/g)
									.map(t => t.trim())
									.filter(t => t !== "");
							}
						}
						return {
							name: field.name || "",
							label: field.label || "",
							value: field.value || "",
							type: field.type || "text",
							dictionary:
								field.dictionary instanceof Array ? field.dictionary : [],
							separator: field.separator || " ",
							suggestion: undefined,
							tagsList: tagsList,
							tagsInputValue: "",
						};
					}
				});
			},
		},
		"fields.length"() {
			this.focus();
		},
		visible: {
			immediate: true,
			handler() {
				this.focus();
			},
		},
	},
	methods: {
		fieldType(f) {
			var type = f.type || "text";
			if (type !== "text" && type !== "password") return "text";
			else return type;
		},
		handleMainClick() {
			var data = {};
			this.formFields.forEach((field) => {
				var value = field.value;
				if (field.type === "tags") {
					value = field.tagsList.join(",");
				} else if (field.type === "number") value = parseInt(value, 10) || 0;
				else if (field.type === "float") value = parseFloat(value) || 0.0;
				else if (field.type === "check") value = Boolean(value);
				data[field.name] = value;
			});

			this.mainClick(data);
		},
		handleSecondClick() {
			this.secondClick();
		},
		handleEscPressed() {
			this.escPressed();
		},
		handleInput(index) {
			// Create initial variable
			var field = this.formFields[index],
				dictionary = field.dictionary;

			// Make sure dictionary is not empty
			if (dictionary.length === 0) return;

			// Fetch suggestion from dictionary
			var lastWord = "";
			if (field.type === "tags") {
				lastWord = field.tagsInputValue.trim().toLowerCase();
			} else {
				var words = field.value.split(field.separator);
				lastWord = words[words.length - 1].toLowerCase();
			}

			var suggestion;
			if (lastWord !== "") {
				suggestion = dictionary.find((word) => {
					if (field.type === "tags") {
						return word.toLowerCase().startsWith(lastWord) && !field.tagsList.includes(word);
					}
					return word.toLowerCase().startsWith(lastWord);
				});
			}

			this.formFields[index].suggestion = suggestion;

			// Make sure suggestion exist
			if (suggestion == null) return;

			// Display suggestion
			this.$nextTick(() => {
				var input = this.$refs.input[index],
					suggestionNode = this.$refs["suggestion-" + index][0],
					inputRect = input.getBoundingClientRect();

				suggestionNode.style.top = inputRect.bottom - 1 + "px";
				suggestionNode.style.left = inputRect.left + "px";
			});
		},
		handleInputEnter(index) {
			var field = this.formFields[index];
			var suggestion = field.suggestion;

			if (suggestion == null) {
				this.handleMainClick();
				return;
			}

			if (field.type === "tags") {
				if (!field.tagsList.includes(suggestion)) {
					field.tagsList.push(suggestion);
				}
				field.tagsInputValue = "";
				field.suggestion = undefined;
				this.$refs.input[index].focus();
				return;
			}

			var separator = this.formFields[index].separator,
				words = this.formFields[index].value.split(separator);

			words.pop();
			words.push(suggestion);

			this.formFields[index].value = words.join(separator) + separator;
			this.formFields[index].suggestion = undefined;
			// Focus input again after suggestion is accepted
			this.$refs.input[index].focus();
		},
		removeTag(fieldIndex, tagIndex) {
			this.formFields[fieldIndex].tagsList.splice(tagIndex, 1);
		},
		addTagFromInput(fieldIndex) {
			var field = this.formFields[fieldIndex];
			var suggestion = field.suggestion;

			if (suggestion != null) {
				this.handleInputEnter(fieldIndex);
				return;
			}

			var rawInput = field.tagsInputValue;
			if (rawInput && rawInput.trim() !== "") {
				var newTags = rawInput
					.toLowerCase()
					.replace(/\s+/g, " ")
					.split(/\s*,\s*/g)
					.map(t => t.trim())
					.filter(t => t !== "");

				newTags.forEach((t) => {
					if (!field.tagsList.includes(t)) {
						field.tagsList.push(t);
					}
				});
			}
			field.tagsInputValue = "";
			field.suggestion = undefined;
		},
		handleTagInputEvent(index) {
			var field = this.formFields[index];
			if (field.tagsInputValue.endsWith(",")) {
				field.tagsInputValue = field.tagsInputValue.slice(0, -1);
				this.addTagFromInput(index);
				return;
			}
			this.handleInput(index);
		},
		handleTagDeleteKey(fieldIndex) {
			var field = this.formFields[fieldIndex];
			if (field.tagsInputValue === "" && field.tagsList.length > 0) {
				field.tagsList.pop();
				field.suggestion = undefined;
			}
		},
		focus() {
			this.$nextTick(() => {
				if (!this.visible) return;

				var fields = this.$refs.input,
					otherInput = this.$el.querySelectorAll("input"),
					button = this.$refs.mainButton;

				if (fields && fields.length > 0) {
					this.$refs.input[0].focus();
					this.$refs.input[0].select();
				} else if (otherInput && otherInput.length > 0) {
					otherInput[0].focus();
					otherInput[0].select();
				} else if (button) {
					button.focus();
				}
			});
		},
	},
};
