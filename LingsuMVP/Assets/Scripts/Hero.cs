using UnityEngine;

namespace LingsuMVP
{
    public class Hero : MonoBehaviour
    {
        [Header("Hero Attributes")]
        public int hp = 100;
        public int maxHp = 100;
        public int attack = 10;
        public int defense = 5;

        private BattleManager _battleManager;

        public void Initialize(BattleManager battleManager)
        {
            _battleManager = battleManager;
            maxHp = hp;
        }

        public void TakeDamage(int damage)
        {
            int actualDamage = Mathf.Max(1, damage - defense);
            hp -= actualDamage;
            hp = Mathf.Max(0, hp);

            Debug.Log($"Hero took {actualDamage} damage. HP: {hp}/{maxHp}");

            if (hp <= 0)
            {
                Die();
            }
        }

        public void Attack(Monster target)
        {
            if (target != null && target.gameObject.activeSelf)
            {
                int damage = attack;
                target.TakeDamage(damage);
                Debug.Log($"Hero attacks Monster for {damage} damage!");
            }
        }

        public void Heal()
        {
            hp = maxHp;
        }

        private void Die()
        {
            Debug.Log("Hero died!");
            if (_battleManager != null)
            {
                _battleManager.OnHeroDead();
            }
        }

        public void ResetStats()
        {
            hp = 100;
            maxHp = 100;
            attack = 10;
            defense = 5;
        }
    }
}