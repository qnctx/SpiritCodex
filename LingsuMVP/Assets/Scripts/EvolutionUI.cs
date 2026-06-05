using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace LingsuMVP
{
    public class EvolutionUI : MonoBehaviour
    {
        [Header("Evolution Settings")]
        public int materialCost = 3;
        public int hpBonus = 20;
        public int attackBonus = 5;
        public int defenseBonus = 3;

        [Header("UI References")]
        public Button evolutionButton;
        public TextMeshProUGUI buttonText;
        public TextMeshProUGUI statusText;

        private Hero _hero;
        private bool _canEvolve = false;
        private bool _hasEvolved = false;

        private void Awake()
        {
            if (evolutionButton != null)
            {
                evolutionButton.onClick.AddListener(OnEvolutionClicked);
            }
        }

        private void Start()
        {
            UpdateUI();
        }

        private void Update()
        {
            CheckEvolutionCondition();
        }

        private void CheckEvolutionCondition()
        {
            if (_hero == null)
            {
                _hero = FindObjectOfType<Hero>();
            }

            if (DropSystem.Instance != null && _hero != null)
            {
                bool canEvolve = DropSystem.Instance.materialCount >= materialCost;
                if (canEvolve != _canEvolve)
                {
                    _canEvolve = canEvolve;
                    UpdateButtonState();
                }

                if (_canEvolve && !_hasEvolved)
                {
                    OnEvolutionClicked();
                }
            }
        }

        private void UpdateButtonState()
        {
            if (evolutionButton != null)
            {
                evolutionButton.interactable = _canEvolve && !_hasEvolved;
            }

            if (statusText != null)
            {
                statusText.text = _hasEvolved ? "Evolution complete" : (_canEvolve ? "Auto evolving" : $"Need {materialCost} materials");
            }
        }

        private void UpdateUI()
        {
            UpdateButtonState();

            if (buttonText != null)
            {
                buttonText.text = "Evolve";
            }
        }

        public void OnEvolutionClicked()
        {
            if (_hero == null)
            {
                _hero = FindObjectOfType<Hero>();
            }

            if (_hero == null || DropSystem.Instance == null)
            {
                Debug.LogWarning("Cannot evolve: Hero or DropSystem not found!");
                return;
            }

            if (DropSystem.Instance.ConsumeMaterials(materialCost))
            {
                ApplyEvolution();
                _hasEvolved = true;
                Debug.Log($"Evolution successful! HP: {_hero.hp}->{_hero.hp + hpBonus}, ATK: {_hero.attack}->{_hero.attack + attackBonus}, DEF: {_hero.defense}->{_hero.defense + defenseBonus}");
            }
            else
            {
                Debug.LogWarning("Cannot evolve: Not enough materials!");
            }
        }

        private void ApplyEvolution()
        {
            _hero.maxHp += hpBonus;
            _hero.hp += hpBonus;
            _hero.attack += attackBonus;
            _hero.defense += defenseBonus;

            UpdateUI();
        }

        public void ResetEvolution()
        {
            _canEvolve = false;
            _hasEvolved = false;
            UpdateUI();
        }
    }
}
